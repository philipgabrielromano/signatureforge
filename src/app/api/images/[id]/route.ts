import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant, writeAudit } from "@/lib/tenant";
import { deleteImageFromBlob } from "@/lib/azureBlob";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const image = await prisma.signatureImage.findUnique({ where: { id: params.id } });
  if (!image || image.tenantId !== tenant.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await deleteImageFromBlob(image.filename);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete blob" },
      { status: 502 }
    );
  }

  await prisma.signatureImage.delete({ where: { id: image.id } });
  await writeAudit({
    tenantId: tenant.id,
    actorEmail: session.user.email,
    action: "image.deleted",
    resourceType: "image",
    resourceId: image.id,
    details: { filename: image.filename },
  });

  return NextResponse.json({ ok: true });
}
