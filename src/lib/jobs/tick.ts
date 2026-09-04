import { activateScheduledCampaigns } from "./activateSchedules";
import { deactivateExpiredCampaigns } from "./deactivateSchedules";
import { deployPendingSignatures } from "./deploySignatures";
import { syncAllTenantUsers } from "./syncUsers";
import { getPrimaryTenant } from "@/lib/tenant";

export async function runCronTick() {
  const results: Record<string, unknown> = {};
  const now = new Date();

  try {
    results.activated = await activateScheduledCampaigns(now);
  } catch (error) {
    results.activateError = String(error);
  }

  try {
    results.deactivated = await deactivateExpiredCampaigns(now);
  } catch (error) {
    results.deactivateError = String(error);
  }

  try {
    const tenant = await getPrimaryTenant();
    results.deployed = await deployPendingSignatures({
      batchSize: tenant.deployBatchSize || 50,
      tenantId: tenant.id,
      actorEmail: "cron",
    });
  } catch (error) {
    results.deployError = String(error);
  }

  try {
    results.synced = await syncAllTenantUsers({ ifOlderThanMinutes: 60 });
  } catch (error) {
    results.syncError = String(error);
  }

  return { ok: true, timestamp: now.toISOString(), ...results };
}
