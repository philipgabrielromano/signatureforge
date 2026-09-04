import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";
import type { AzureTenantConfig } from "@/types";

export function isGraphConfigured(config?: AzureTenantConfig | null): boolean {
  if (!config) return false;
  if (!config.azureClientId || !config.azureTenantId || !config.azureClientSecret) return false;
  if (config.azureClientId.startsWith("xxxxxxxx")) return false;
  if (config.azureClientSecret.includes("placeholder")) return false;
  return true;
}

export async function getGraphClient(tenantConfig: AzureTenantConfig) {
  const credential = new ClientSecretCredential(
    tenantConfig.azureTenantId,
    tenantConfig.azureClientId,
    tenantConfig.azureClientSecret
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  return Client.initWithMiddleware({ authProvider });
}

export async function getAccessToken(
  tenantConfig: AzureTenantConfig,
  resource: "graph" | "outlook" = "outlook"
): Promise<string> {
  const credential = new ClientSecretCredential(
    tenantConfig.azureTenantId,
    tenantConfig.azureClientId,
    tenantConfig.azureClientSecret
  );
  const scope =
    resource === "graph"
      ? "https://graph.microsoft.com/.default"
      : "https://outlook.office365.com/.default";
  const token = await credential.getToken(scope);
  if (!token?.token) {
    throw new Error(`Failed to acquire ${resource} access token`);
  }
  return token.token;
}

export async function testGraphConnection(
  tenantConfig: AzureTenantConfig
): Promise<{ ok: boolean; message: string }> {
  try {
    const client = await getGraphClient(tenantConfig);
    const meOrg = await client.api("/organization").get();
    const name = meOrg?.value?.[0]?.displayName ?? "tenant";
    return { ok: true, message: `Connected to Microsoft Graph for ${name}.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
