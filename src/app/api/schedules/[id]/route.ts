import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant, writeAudit } from "@/lib/tenant";
import { resolveParams, type RouteParams } from "@/lib/routeParams";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(["scheduled", "active", "completed", "cancelled"]).optional(),
  name: z.string().min(1).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams<{ id: string }>) {
  const { id } = await resolveParams(params);
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const body = schema.parse(await request.json());
  const tenant = await getPrimaryTenant();
  const existing = await prisma.schedule.findUnique({ where: { id } });
  if (!existing || existing.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const schedule = await prisma.schedule.update({
    where: { id },
    data: {
      status: body.status,
      name: body.name,
      startAt: body.startAt ? new Date(body.startAt) : undefined,
      endAt: body.endAt === undefined ? undefined : body.endAt ? new Date(body.endAt) : null,
    },
    include: { template: true },
  });

  await writeAudit({
    tenantId: tenant.id,
    actorEmail: session.user.email,
    action: "schedule.updated",
    resourceType: "schedule",
    resourceId: schedule.id,
    details: body,
  });

  return NextResponse.json({ schedule });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams<{ id: string }>) {
  const { id } = await resolveParams(params);
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const existing = await prisma.schedule.findUnique({ where: { id } });
  if (!existing || existing.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.schedule.update({
    where: { id },
    data: { status: "cancelled" },
  });

  await writeAudit({
    tenantId: tenant.id,
    actorEmail: session.user.email,
    action: "schedule.cancelled",
    resourceType: "schedule",
    resourceId: id,
  });

  return NextResponse.json({ ok: true });
}
