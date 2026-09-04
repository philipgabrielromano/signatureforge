import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant } from "@/lib/tenant";
import { deployPendingSignatures } from "@/lib/jobs/deploySignatures";
import { resolveParams, type RouteParams } from "@/lib/routeParams";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: RouteParams<{ userId: string }>) {
  const { userId } = await resolveParams(params);
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { signaturePushStatus: "pending", signaturePushError: null },
  });

  const result = await deployPendingSignatures({
    batchSize: 1,
    userIds: [user.id],
    actorEmail: session.user.email,
  });

  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    include: { currentSignature: true },
  });

  return NextResponse.json({ result, user: updated });
}
