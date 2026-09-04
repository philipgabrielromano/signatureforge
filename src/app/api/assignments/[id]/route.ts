import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant, writeAudit } from "@/lib/tenant";
import { markUsersPendingForTemplate } from "@/lib/jobs/deploySignatures";

export const dynamic = "force-dynamic";

const schema = z.object({
  templateId: z.string().min(1).optional(),
  isOrgWide: z.boolean().optional(),
  targetType: z.enum(["user", "department", "group"]).optional().nullable(),
  targetValue: z.string().optional().nullable(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const body = schema.parse(await request.json());
  const tenant = await getPrimaryTenant();
  const existing = await prisma.assignment.findUnique({ where: { id: params.id } });
  if (!existing || existing.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assignment = await prisma.assignment.update({
    where: { id: params.id },
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const existing = await prisma.assignment.findUnique({ where: { id: params.id } });
  if (!existing || existing.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.assignment.delete({ where: { id: params.id } });
  await writeAudit({
    tenantId: tenant.id,
    actorEmail: session.user.email,
    action: "assignment.deleted",
    resourceType: "assignment",
    resourceId: params.id,
  });

  return NextResponse.json({ ok: true });
}
