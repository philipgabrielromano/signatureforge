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
  const action = searchParams.get("action") || "";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const format = searchParams.get("format");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") || 25)));

  const where = {
    tenantId: tenant.id,
    ...(action ? { action } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  if (format === "csv") {
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    const header = "createdAt,actorEmail,action,resourceType,resourceId,details";
    const rows = logs.map((log) =>
      [
        log.createdAt.toISOString(),
        csv(log.actorEmail),
        csv(log.action),
        csv(log.resourceType),
        csv(log.resourceId || ""),
        csv(JSON.stringify(log.details ?? {})),
      ].join(",")
    );
    const csvBody = [header, ...rows].join("\n");
    return new NextResponse(csvBody, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=signatureforge-audit.csv",
      },
    });
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, pageSize });
}

function csv(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
