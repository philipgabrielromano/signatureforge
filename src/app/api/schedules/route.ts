import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant, writeAudit } from "@/lib/tenant";
import { schedulesOverlap } from "@/lib/assignments";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  templateId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional().nullable(),
  isOrgWide: z.boolean().optional(),
  targetType: z.enum(["user", "department", "group"]).optional().nullable(),
  targetValue: z.string().optional().nullable(),
  revertTemplateId: z.string().optional().nullable(),
  overrideConflicts: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const schedules = await prisma.schedule.findMany({
    where: { tenantId: tenant.id },
    include: { template: true },
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json({ schedules });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const body = schema.parse(await request.json());
  const tenant = await getPrimaryTenant();
  const startAt = new Date(body.startAt);
  const endAt = body.endAt ? new Date(body.endAt) : null;

  const existing = await prisma.schedule.findMany({
    where: { tenantId: tenant.id, status: { in: ["scheduled", "active"] } },
  });

  const conflicts = existing.filter((s) =>
    schedulesOverlap(
      {
        startAt,
        endAt,
        isOrgWide: body.isOrgWide ?? false,
        targetType: body.targetType ?? null,
        targetValue: body.targetValue ?? null,
      },
      s
    )
  );

  if (conflicts.length > 0 && !body.overrideConflicts) {
    return NextResponse.json(
      {
        warning: true,
        message:
          "This schedule overlaps another campaign targeting the same users. Resubmit with overrideConflicts: true to create it anyway.",
        conflicts: conflicts.map((c) => ({ id: c.id, name: c.name, startAt: c.startAt, endAt: c.endAt })),
      },
      { status: 409 }
    );
  }

  const schedule = await prisma.schedule.create({
    data: {
      tenantId: tenant.id,
      templateId: body.templateId,
      name: body.name,
      description: body.description ?? null,
      startAt,
      endAt,
      isOrgWide: body.isOrgWide ?? false,
      targetType: body.isOrgWide ? null : body.targetType ?? null,
      targetValue: body.isOrgWide ? null : body.targetValue ?? null,
      revertTemplateId: body.revertTemplateId ?? null,
      status: "scheduled",
    },
    include: { template: true },
  });

  await writeAudit({
    tenantId: tenant.id,
    actorEmail: session.user.email,
    action: "schedule.created",
    resourceType: "schedule",
    resourceId: schedule.id,
    details: { conflicts: conflicts.map((c) => c.id) },
  });

  return NextResponse.json({ schedule, conflicts }, { status: 201 });
}
