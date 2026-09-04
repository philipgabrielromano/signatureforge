import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const [pending, success, failed, total, job] = await Promise.all([
    prisma.user.count({ where: { tenantId: tenant.id, signaturePushStatus: "pending" } }),
    prisma.user.count({ where: { tenantId: tenant.id, signaturePushStatus: "success" } }),
    prisma.user.count({ where: { tenantId: tenant.id, signaturePushStatus: "failed" } }),
    prisma.user.count({ where: { tenantId: tenant.id } }),
    prisma.deployJob.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ pending, success, failed, total, job });
}
