import { prisma } from "@/lib/prisma";
import { resolveTemplateForUser } from "@/lib/assignments";
import { injectSignatureForUser } from "@/lib/graph/signatures";
import { isGraphConfigured } from "@/lib/graph/client";
import { tenantGraphConfig } from "@/lib/tenant";
import { resolveVariables, toUserProfile } from "@/lib/variables";
import { writeAudit } from "@/lib/tenant";
import type { DeployBatchResult } from "@/types";
import type { Assignment, Template } from "@prisma/client";

export async function markUsersPendingForTemplate(templateId: string) {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { assignments: true },
  });
  if (!template) return 0;

  const users = await prisma.user.findMany({ where: { tenantId: template.tenantId } });
  const assignments = await prisma.assignment.findMany({
    where: { tenantId: template.tenantId, isActive: true },
    include: { template: true },
  });

  const ids = users
    .filter((user) => resolveTemplateForUser(user, assignments)?.id === templateId)
    .map((user) => user.id);

  if (ids.length === 0) return 0;

  await prisma.user.updateMany({
    where: { id: { in: ids } },
    data: { signaturePushStatus: "pending", signaturePushError: null },
  });

  return ids.length;
}

export async function deployPendingSignatures(options: {
  batchSize?: number;
  tenantId?: string;
  userIds?: string[];
  actorEmail?: string;
  jobId?: string;
} = {}): Promise<DeployBatchResult> {
  const batchSize = options.batchSize ?? 50;

  const where = options.userIds?.length
    ? { id: { in: options.userIds } }
    : {
        signaturePushStatus: { in: ["pending", "failed"] },
        ...(options.tenantId ? { tenantId: options.tenantId } : {}),
      };

  const users = await prisma.user.findMany({
    where,
    take: batchSize,
    orderBy: { updatedAt: "asc" },
    include: { tenant: true },
  });

  const remainingWhere = options.userIds?.length
    ? { id: { in: options.userIds }, signaturePushStatus: { in: ["pending", "failed"] } }
    : {
        signaturePushStatus: { in: ["pending", "failed"] },
        ...(options.tenantId ? { tenantId: options.tenantId } : {}),
      };

  const result: DeployBatchResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    remaining: 0,
  };

  if (users.length === 0) {
    result.remaining = await prisma.user.count({ where: remainingWhere });
    return result;
  }

  const assignmentsByTenant = new Map<string, Array<Assignment & { template: Template }>>();

  for (const user of users) {
    result.processed += 1;
    try {
      let assignments = assignmentsByTenant.get(user.tenantId);
      if (!assignments) {
        assignments = await prisma.assignment.findMany({
          where: { tenantId: user.tenantId, isActive: true },
          include: { template: true },
        });
        assignmentsByTenant.set(user.tenantId, assignments);
      }

      const template = resolveTemplateForUser(user, assignments);
      if (!template) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            signaturePushStatus: "failed",
            signaturePushError: "No matching assignment for this user",
          },
        });
        result.failed += 1;
        continue;
      }

      const html = resolveVariables(template.htmlContent, toUserProfile(user));
      const config = tenantGraphConfig(user.tenant);

      if (!isGraphConfigured(config)) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            currentSignatureId: template.id,
            lastSignaturePushedAt: new Date(),
            signaturePushStatus: "failed",
            signaturePushError:
              "Microsoft 365 app credentials are not configured. Set MS365_CLIENT_ID, MS365_CLIENT_SECRET, and MS365_TENANT_ID, then retry.",
          },
        });
        result.failed += 1;
        continue;
      }

      const inject = await injectSignatureForUser({
        userId: user.azureObjectId,
        userEmail: user.email,
        htmlContent: html,
        signatureName: template.name,
        tenantConfig: config,
      });

      if (inject.success) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            currentSignatureId: template.id,
            lastSignaturePushedAt: new Date(),
            signaturePushStatus: "success",
            signaturePushError: null,
          },
        });
        result.succeeded += 1;
        await writeAudit({
          tenantId: user.tenantId,
          actorEmail: options.actorEmail ?? "cron",
          action: "signature.deployed",
          resourceType: "user",
          resourceId: user.id,
          details: { method: inject.method, templateId: template.id },
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            signaturePushStatus: "failed",
            signaturePushError: inject.error ?? "Injection failed",
          },
        });
        result.failed += 1;
        await writeAudit({
          tenantId: user.tenantId,
          actorEmail: options.actorEmail ?? "cron",
          action: "signature.deploy_failed",
          resourceType: "user",
          resourceId: user.id,
          details: { error: inject.error, method: inject.method },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.user.update({
        where: { id: user.id },
        data: { signaturePushStatus: "failed", signaturePushError: message },
      });
      result.failed += 1;
    }

    if (options.jobId) {
      await prisma.deployJob.update({
        where: { id: options.jobId },
        data: {
          completed: { increment: 1 },
          succeeded: result.succeeded,
          failed: result.failed,
        },
      });
    }
  }

  result.remaining = await prisma.user.count({ where: remainingWhere });
  return result;
}

export async function createDeployJob(tenantId: string, userIds?: string[]) {
  const total = userIds?.length
    ? userIds.length
    : await prisma.user.count({
        where: { tenantId, signaturePushStatus: { in: ["pending", "failed"] } },
      });

  return prisma.deployJob.create({
    data: { tenantId, total, status: "running" },
  });
}
