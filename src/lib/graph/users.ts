import type { AzureTenantConfig, UserSyncResult } from "@/types";
import { getGraphClient } from "./client";
import { prisma } from "@/lib/prisma";

type GraphUser = {
  id: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  mail?: string;
  userPrincipalName?: string;
  jobTitle?: string;
  department?: string;
  mobilePhone?: string;
  businessPhones?: string[];
  officeLocation?: string;
  companyName?: string;
};

export async function syncUsersFromGraph(
  tenantId: string,
  tenantConfig: AzureTenantConfig
): Promise<UserSyncResult> {
  const client = await getGraphClient(tenantConfig);
  const result: UserSyncResult = { added: 0, updated: 0, unchanged: 0, errors: [] };

  const select =
    "id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,mobilePhone,businessPhones,officeLocation,companyName";

  let url: string | null = `/users?$select=${select}&$top=999&$filter=accountEnabled eq true`;

  while (url) {
    try {
      const page = await client.api(url).get();
      const users: GraphUser[] = page.value ?? [];

      for (const graphUser of users) {
        try {
          const email = graphUser.mail || graphUser.userPrincipalName;
          if (!email) {
            result.errors.push(`Skipped ${graphUser.id}: no mail or UPN`);
            continue;
          }

          const data = {
            azureObjectId: graphUser.id,
            email,
            displayName: graphUser.displayName || email,
            firstName: graphUser.givenName ?? null,
            lastName: graphUser.surname ?? null,
            jobTitle: graphUser.jobTitle ?? null,
            department: graphUser.department ?? null,
            phone: graphUser.businessPhones?.[0] ?? null,
            mobile: graphUser.mobilePhone ?? null,
            officeLocation: graphUser.officeLocation ?? null,
            companyName: graphUser.companyName ?? null,
          };

          const existing = await prisma.user.findUnique({
            where: { tenantId_azureObjectId: { tenantId, azureObjectId: graphUser.id } },
          });

          if (!existing) {
            await prisma.user.create({
              data: { tenantId, ...data, signaturePushStatus: "pending" },
            });
            result.added += 1;
            continue;
          }

          const changed =
            existing.email !== data.email ||
            existing.displayName !== data.displayName ||
            existing.firstName !== data.firstName ||
            existing.lastName !== data.lastName ||
            existing.jobTitle !== data.jobTitle ||
            existing.department !== data.department ||
            existing.phone !== data.phone ||
            existing.mobile !== data.mobile ||
            existing.officeLocation !== data.officeLocation ||
            existing.companyName !== data.companyName;

          if (changed) {
            await prisma.user.update({
              where: { id: existing.id },
              data,
            });
            result.updated += 1;
          } else {
            result.unchanged += 1;
          }
        } catch (error) {
          result.errors.push(
            `${graphUser.id}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      const nextLink: string | undefined = page["@odata.nextLink"];
      url = nextLink ? nextLink.replace("https://graph.microsoft.com/v1.0", "") : null;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      break;
    }
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { lastSyncAt: new Date() },
  });

  return result;
}
