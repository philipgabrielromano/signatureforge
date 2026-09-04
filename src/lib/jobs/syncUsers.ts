import { prisma } from "@/lib/prisma";
import { syncUsersFromGraph } from "@/lib/graph/users";
import { isGraphConfigured } from "@/lib/graph/client";
import { tenantGraphConfig, writeAudit } from "@/lib/tenant";

export async function syncAllTenantUsers(options: { ifOlderThanMinutes?: number } = {}) {
  const tenants = await prisma.tenant.findMany({ where: { syncEnabled: true } });
  const thresholdMinutes = options.ifOlderThanMinutes ?? 60;
  const results = [];

  for (const tenant of tenants) {
    if (tenant.lastSyncAt) {
      const ageMs = Date.now() - tenant.lastSyncAt.getTime();
      if (ageMs < thresholdMinutes * 60 * 1000) {
        results.push({
          tenantId: tenant.id,
          skipped: true,
          reason: `Last sync ${Math.round(ageMs / 60000)} minutes ago`,
        });
        continue;
      }
    }

    const config = tenantGraphConfig(tenant);
    if (!isGraphConfigured(config)) {
      results.push({
        tenantId: tenant.id,
        skipped: true,
        reason: "Microsoft Graph credentials are not configured",
      });
      continue;
    }

    const sync = await syncUsersFromGraph(tenant.id, config);
    await writeAudit({
      tenantId: tenant.id,
      actorEmail: "cron",
      action: "users.synced",
      resourceType: "tenant",
      resourceId: tenant.id,
      details: sync,
    });
    results.push({ tenantId: tenant.id, skipped: false, ...sync });
  }

  return results;
}
