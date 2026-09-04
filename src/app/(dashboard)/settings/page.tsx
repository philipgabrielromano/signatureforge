import { getPrimaryTenant, tenantGraphConfig } from "@/lib/tenant";
import { isGraphConfigured } from "@/lib/graph/client";
import { isAzureStorageConfigured } from "@/lib/azureBlob";
import { Header } from "@/components/layout/Header";
import { SettingsForm } from "@/components/dashboard/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const tenant = await getPrimaryTenant();

  return (
    <>
      <Header title="Settings" subtitle="Azure AD, Graph injection, Blob storage, and tenant identity" />
      <div className="p-4 lg:p-8">
        <SettingsForm
          tenant={{
            name: tenant.name,
            domain: tenant.domain,
            azureClientId: tenant.azureClientId,
            azureTenantId: tenant.azureTenantId,
            syncEnabled: tenant.syncEnabled,
            syncFrequencyMinutes: tenant.syncFrequencyMinutes,
            autoDeployOnSave: tenant.autoDeployOnSave,
            deployBatchSize: tenant.deployBatchSize,
          }}
          graphConfigured={isGraphConfigured(tenantGraphConfig(tenant))}
          storageConfigured={isAzureStorageConfigured()}
          storage={{
            accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || "",
            containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || "",
            publicUrl: process.env.AZURE_STORAGE_PUBLIC_URL || "",
          }}
        />
      </div>
    </>
  );
}
