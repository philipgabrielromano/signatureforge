import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const department = searchParams.get("department") || "";
  const status = searchParams.get("status") || "";
  const parsedLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : undefined;

  const users = await prisma.user.findMany({
    where: {
      tenantId: tenant.id,
      ...(department ? { department } : {}),
      ...(status ? { signaturePushStatus: status } : {}),
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { department: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { currentSignature: true },
    orderBy: { displayName: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  const departments = await prisma.user.findMany({
    where: { tenantId: tenant.id, department: { not: null } },
    distinct: ["department"],
    select: { department: true },
  });

  return NextResponse.json({
    users,
    departments: departments.map((d) => d.department).filter(Boolean),
  });
}
