import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant, writeAudit } from "@/lib/tenant";
import { markUsersPendingForTemplate } from "@/lib/jobs/deploySignatures";
import { resolveParams, type RouteParams } from "@/lib/routeParams";

export const dynamic = "force-dynamic";

const schema = z.object({
  templateId: z.string().min(1).optional(),
  isOrgWide: z.boolean().optional(),
  targetType: z.enum(["user", "department", "group"]).optional().nullable(),
  targetValue: z.string().optional().nullable(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams<{ id: string }>) {
  const { id } = await resolveParams(params);
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const body = schema.parse(await request.json());
  const tenant = await getPrimaryTenant();
  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing || existing.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assignment = await prisma.assignment.update({
    where: { id },
    data: body,
    include: { template: true },
  });

  await markUsersPendingForTemplate(assignment.templateId);
  await writeAudit({
    tenantId: tenant.id,
    actorEmail: session.user.email,
    action: "assignment.updated",
    resourceType: "assignment",
    resourceId: assignment.id,
    details: body,
  });

  return NextResponse.json({ assignment });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams<{ id: string }>) {
  const { id } = await resolveParams(params);
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const existing = await prisma.assignment.findUnique({ where: { id } });
  if (!existing || existing.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.assignment.delete({ where: { id } });
  await writeAudit({
    tenantId: tenant.id,
    actorEmail: session.user.email,
    action: "assignment.deleted",
    resourceType: "assignment",
    resourceId: id,
  });

  return NextResponse.json({ ok: true });
}
