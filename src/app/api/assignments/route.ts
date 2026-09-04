import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant, writeAudit } from "@/lib/tenant";
import { markUsersPendingForTemplate } from "@/lib/jobs/deploySignatures";

export const dynamic = "force-dynamic";

const schema = z.object({
  templateId: z.string().min(1),
  isOrgWide: z.boolean().optional(),
  targetType: z.enum(["user", "department", "group"]).optional().nullable(),
  targetValue: z.string().optional().nullable(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const assignments = await prisma.assignment.findMany({
    where: { tenantId: tenant.id },
    include: { template: true },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ assignments });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const body = schema.parse(await request.json());
  const tenant = await getPrimaryTenant();

  const assignment = await prisma.assignment.create({
    data: {
      tenantId: tenant.id,
      templateId: body.templateId,
      isOrgWide: body.isOrgWide ?? false,
      targetType: body.isOrgWide ? null : body.targetType ?? null,
      targetValue: body.isOrgWide ? null : body.targetValue ?? null,
      priority: body.priority ?? 0,
      isActive: body.isActive ?? true,
    },
    include: { template: true },
  });

  await markUsersPendingForTemplate(body.templateId);
  await writeAudit({
    tenantId: tenant.id,
    actorEmail: session.user.email,
    action: "assignment.created",
    resourceType: "assignment",
    resourceId: assignment.id,
    details: body,
  });

  return NextResponse.json({ assignment }, { status: 201 });
}
