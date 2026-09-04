import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant, tenantGraphConfig } from "@/lib/tenant";
import { isGraphConfigured } from "@/lib/graph/client";
import { getDirectoryGroupsByIds, listDirectoryGroups } from "@/lib/graph/groups";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") || "users";
  const q = searchParams.get("q")?.trim() || "";
  const ids = (searchParams.get("ids") || "").split(",").map((id) => id.trim()).filter(Boolean);
  const parsedLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 50;

  if (kind === "departments") {
    const rows = await prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        department: { not: null, ...(q ? { contains: q, mode: "insensitive" as const } : {}) },
      },
      distinct: ["department"],
      select: { department: true },
      orderBy: { department: "asc" },
    });
    return NextResponse.json({
      items: rows
        .map((row) => row.department)
        .filter((name): name is string => Boolean(name))
        .map((name) => ({ id: name, label: name })),
    });
  }

  if (kind === "groups") {
    const config = tenantGraphConfig(tenant);
    if (!isGraphConfigured(config)) {
      return NextResponse.json({ items: [] });
    }
    try {
      const groups = ids.length
        ? await getDirectoryGroupsByIds(config, ids)
        : await listDirectoryGroups(config, q || undefined);
      return NextResponse.json({
        items: groups.map((group) => ({
          id: group.id,
          label: group.displayName,
          description: group.mail,
        })),
      });
    } catch {
      return NextResponse.json({ items: [] });
    }
  }

  const users = await prisma.user.findMany({
    where: {
      tenantId: tenant.id,
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
    select: { id: true, email: true, displayName: true, azureObjectId: true },
    orderBy: { displayName: "asc" },
    take: limit,
  });

  return NextResponse.json({
    items: users.map((user) => ({
      id: user.email,
      label: user.displayName,
      description: user.email,
    })),
  });
}
