import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant, writeAudit } from "@/lib/tenant";
import { markUsersPendingForTemplate } from "@/lib/jobs/deploySignatures";
import { findUnsafeImageUrls } from "@/lib/utils";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  htmlContent: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  deploy: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const template = await prisma.template.findUnique({
    where: { id: params.id },
    include: {
      templateVersions: { orderBy: { version: "desc" }, take: 10 },
      _count: { select: { currentUsers: true, assignments: true } },
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ template, unsafeImageUrls: findUnsafeImageUrls(template.htmlContent) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const body = updateSchema.parse(await request.json());
  const tenant = await getPrimaryTenant();
  const existing = await prisma.template.findUnique({ where: { id: params.id } });
  if (!existing || existing.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const htmlChanged = body.htmlContent && body.htmlContent !== existing.htmlContent;
  const nextVersion = htmlChanged ? existing.version + 1 : existing.version;

  const template = await prisma.template.update({
    where: { id: params.id },
    data: {
      name: body.name,
      description: body.description,
      htmlContent: body.htmlContent,
      isDefault: body.isDefault,
      isActive: body.isActive,
      version: nextVersion,
    },
  });

  if (htmlChanged && body.htmlContent) {
    await prisma.templateVersion.create({
      data: {
        templateId: template.id,
        version: nextVersion,
        htmlContent: body.htmlContent,
        changedBy: session.user.email,
      },
    });
  }

  if (body.isDefault) {
    await prisma.template.updateMany({
      where: { tenantId: tenant.id, id: { not: template.id } },
      data: { isDefault: false },
    });
  }

  await writeAudit({
    tenantId: tenant.id,
    actorEmail: session.user.email,
    action: "template.updated",
    resourceType: "template",
    resourceId: template.id,
    details: { version: template.version, deploy: Boolean(body.deploy) },
  });

  let pending = 0;
  if (body.deploy !== false && (htmlChanged || body.deploy)) {
    pending = await markUsersPendingForTemplate(template.id);
  }

  return NextResponse.json({
    template,
    pendingUsers: pending,
    unsafeImageUrls: findUnsafeImageUrls(template.htmlContent),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const existing = await prisma.template.findUnique({ where: { id: params.id } });
  if (!existing || existing.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.template.delete({ where: { id: params.id } });
  await writeAudit({
    tenantId: tenant.id,
    actorEmail: session.user.email,
    action: "template.deleted",
    resourceType: "template",
    resourceId: params.id,
    details: { name: existing.name },
  });

  return NextResponse.json({ ok: true });
}
