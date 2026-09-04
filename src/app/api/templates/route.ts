import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant, writeAudit } from "@/lib/tenant";
import { markUsersPendingForTemplate } from "@/lib/jobs/deploySignatures";
import { findUnsafeImageUrls } from "@/lib/utils";

export const dynamic = "force-dynamic";

const templateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  htmlContent: z.string().min(1),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  deploy: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const templates = await prisma.template.findMany({
    where: { tenantId: tenant.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { currentUsers: true, assignments: true } },
    },
  });

  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const body = templateSchema.parse(await request.json());
  const tenant = await getPrimaryTenant();
  const unsafe = findUnsafeImageUrls(body.htmlContent);

  const template = await prisma.template.create({
    data: {
      tenantId: tenant.id,
      name: body.name,
      description: body.description ?? null,
      htmlContent: body.htmlContent,
      isDefault: body.isDefault ?? false,
      isActive: body.isActive ?? true,
    },
  });

  await prisma.templateVersion.create({
    data: {
      templateId: template.id,
      version: 1,
      htmlContent: body.htmlContent,
      changedBy: session.user.email,
    },
  });

  if (body.isDefault) {
    await prisma.template.updateMany({
      where: { tenantId: tenant.id, id: { not: template.id } },
      data: { isDefault: false },
    });
  }

  await writeAudit({
    tenantId: tenant.id,
    actorEmail: session.user.email,
    action: "template.created",
    resourceType: "template",
    resourceId: template.id,
    details: { name: template.name },
  });

  if (body.deploy && tenant.autoDeployOnSave) {
    await markUsersPendingForTemplate(template.id);
  }

  return NextResponse.json({ template, unsafeImageUrls: unsafe }, { status: 201 });
}
