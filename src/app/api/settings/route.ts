import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant, tenantGraphConfig, writeAudit } from "@/lib/tenant";
import { isGraphConfigured, testGraphConnection } from "@/lib/graph/client";
import { isAzureStorageConfigured, testBlobConnection } from "@/lib/azureBlob";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  domain: z.string().min(1).optional(),
  azureClientId: z.string().optional(),
  azureClientSecret: z.string().optional(),
  azureTenantId: z.string().optional(),
  syncEnabled: z.boolean().optional(),
  syncFrequencyMinutes: z.number().int().min(5).max(1440).optional(),
  autoDeployOnSave: z.boolean().optional(),
  deployBatchSize: z.number().int().min(1).max(200).optional(),
  danger: z.enum(["reset-assignments", "clear-sync"]).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  return NextResponse.json({
    tenant: {
      ...tenant,
      azureClientSecret: tenant.azureClientSecret ? "********" : "",
    },
    graphConfigured: isGraphConfigured(tenantGraphConfig(tenant)),
    storageConfigured: isAzureStorageConfigured(),
    storage: {
      accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || "",
      containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || "",
      publicUrl: process.env.AZURE_STORAGE_PUBLIC_URL || "",
    },
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const body = updateSchema.parse(await request.json());
  const tenant = await getPrimaryTenant();

  if (body.danger === "reset-assignments") {
    await prisma.assignment.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.user.updateMany({
      where: { tenantId: tenant.id },
      data: {
        currentSignatureId: null,
        signaturePushStatus: "pending",
        signaturePushError: null,
      },
    });
    await writeAudit({
      tenantId: tenant.id,
      actorEmail: session.user.email,
      action: "settings.reset_assignments",
      resourceType: "tenant",
      resourceId: tenant.id,
    });
    return NextResponse.json({ ok: true, danger: "reset-assignments" });
  }

  if (body.danger === "clear-sync") {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { lastSyncAt: null },
    });
    await writeAudit({
      tenantId: tenant.id,
      actorEmail: session.user.email,
      action: "settings.clear_sync",
      resourceType: "tenant",
      resourceId: tenant.id,
    });
    return NextResponse.json({ ok: true, danger: "clear-sync" });
  }

  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      name: body.name,
      domain: body.domain,
      azureClientId: body.azureClientId,
      azureClientSecret:
        body.azureClientSecret && body.azureClientSecret !== "********"
          ? body.azureClientSecret
          : undefined,
      azureTenantId: body.azureTenantId,
      syncEnabled: body.syncEnabled,
      syncFrequencyMinutes: body.syncFrequencyMinutes,
      autoDeployOnSave: body.autoDeployOnSave,
      deployBatchSize: body.deployBatchSize,
    },
  });

  await writeAudit({
    tenantId: tenant.id,
    actorEmail: session.user.email,
    action: "settings.updated",
    resourceType: "tenant",
    resourceId: tenant.id,
  });

  return NextResponse.json({
    tenant: { ...updated, azureClientSecret: "********" },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const { test } = (await request.json()) as { test?: string };
  const tenant = await getPrimaryTenant();

  if (test === "graph") {
    const result = await testGraphConnection(tenantGraphConfig(tenant));
    return NextResponse.json(result);
  }

  if (test === "storage") {
    const result = await testBlobConnection();
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown test" }, { status: 400 });
}
