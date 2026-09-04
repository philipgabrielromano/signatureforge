import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant, writeAudit } from "@/lib/tenant";
import {
  createDeployJob,
  deployPendingSignatures,
  markUsersPendingForTemplate,
} from "@/lib/jobs/deploySignatures";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({
  userIds: z.array(z.string()).optional(),
  templateId: z.string().optional(),
  immediate: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const body = schema.parse(await request.json().catch(() => ({})));
  const tenant = await getPrimaryTenant();

  if (body.templateId) {
    await markUsersPendingForTemplate(body.templateId);
  } else if (body.userIds?.length) {
    await prisma.user.updateMany({
      where: { id: { in: body.userIds }, tenantId: tenant.id },
      data: { signaturePushStatus: "pending", signaturePushError: null },
    });
  } else {
    await prisma.user.updateMany({
      where: { tenantId: tenant.id },
      data: { signaturePushStatus: "pending", signaturePushError: null },
    });
  }

  const job = await createDeployJob(tenant.id, body.userIds);

  await writeAudit({
    tenantId: tenant.id,
    actorEmail: session.user.email,
    action: "deploy.started",
    resourceType: "deploy",
    resourceId: job.id,
    details: { immediate: Boolean(body.immediate), userCount: job.total },
  });

  if (body.immediate) {
    const result = await deployPendingSignatures({
      batchSize: tenant.deployBatchSize || 50,
      tenantId: tenant.id,
      userIds: body.userIds,
      actorEmail: session.user.email,
      jobId: job.id,
    });

    await prisma.deployJob.update({
      where: { id: job.id },
      data: {
        status: result.remaining > 0 ? "running" : "completed",
        completed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        finishedAt: result.remaining > 0 ? null : new Date(),
      },
    });

    return NextResponse.json({ jobId: job.id, ...result });
  }

  return NextResponse.json({
    jobId: job.id,
    queued: job.total,
    message: "Users marked pending. The Render cron job will inject signatures within 5 minutes.",
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const [pending, success, failed, latestJob] = await Promise.all([
    prisma.user.count({ where: { tenantId: tenant.id, signaturePushStatus: "pending" } }),
    prisma.user.count({ where: { tenantId: tenant.id, signaturePushStatus: "success" } }),
    prisma.user.count({ where: { tenantId: tenant.id, signaturePushStatus: "failed" } }),
    prisma.deployJob.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ pending, success, failed, job: latestJob });
}
