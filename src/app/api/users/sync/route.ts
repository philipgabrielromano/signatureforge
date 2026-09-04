import { NextResponse } from "next/server";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant, tenantGraphConfig, writeAudit } from "@/lib/tenant";
import { isGraphConfigured } from "@/lib/graph/client";
import { syncUsersFromGraph } from "@/lib/graph/users";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const config = tenantGraphConfig(tenant);

  if (!isGraphConfigured(config)) {
    return NextResponse.json(
      {
        error:
          "Microsoft Graph is not configured. Add MS365_CLIENT_ID, MS365_CLIENT_SECRET, and MS365_TENANT_ID, or update Settings.",
      },
      { status: 400 }
    );
  }

  const result = await syncUsersFromGraph(tenant.id, config);
  await writeAudit({
    tenantId: tenant.id,
    actorEmail: session.user.email,
    action: "users.synced",
    resourceType: "tenant",
    resourceId: tenant.id,
    details: result,
  });

  return NextResponse.json(result);
}
