import { prisma } from "@/lib/prisma";
import type { AzureTenantConfig } from "@/types";
import type { Tenant, Prisma } from "@prisma/client";

export async function getPrimaryTenant(): Promise<Tenant> {
  const existing = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;

  return prisma.tenant.create({
    data: {
      name: "Contoso",
      domain: "contoso.com",
      azureClientId: process.env.MS365_CLIENT_ID || "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      azureClientSecret: process.env.MS365_CLIENT_SECRET || "placeholder-secret",
      azureTenantId: process.env.MS365_TENANT_ID || "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    },
  });
}

export function tenantGraphConfig(tenant: Tenant): AzureTenantConfig {
  const envFallback: AzureTenantConfig = {
    azureTenantId: process.env.MS365_TENANT_ID || tenant.azureTenantId,
    azureClientId: process.env.MS365_CLIENT_ID || tenant.azureClientId,
    azureClientSecret: process.env.MS365_CLIENT_SECRET || tenant.azureClientSecret,
  };

  const fromTenant: AzureTenantConfig = {
    azureTenantId: tenant.azureTenantId,
    azureClientId: tenant.azureClientId,
    azureClientSecret: tenant.azureClientSecret,
  };

  const looksPlaceholder =
    fromTenant.azureClientId.startsWith("xxxxxxxx") ||
    fromTenant.azureClientSecret.includes("placeholder");

  return looksPlaceholder ? envFallback : fromTenant;
}

export async function writeAudit(params: {
  tenantId: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      actorEmail: params.actorEmail,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? null,
      details: (params.details as Prisma.InputJsonValue) ?? undefined,
    },
  });
}
