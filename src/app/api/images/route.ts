import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth, unauthorizedResponse } from "@/lib/auth";
import { getPrimaryTenant, writeAudit } from "@/lib/tenant";
import {
  blobPreviewPath,
  getDurablePublicUrl,
  isAzureStorageConfigured,
  isSignedBlobUrl,
  uploadImageToBlob,
} from "@/lib/azureBlob";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
const MAX_SIZE = 5 * 1024 * 1024;

export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorizedResponse();

  const tenant = await getPrimaryTenant();
  const images = await prisma.signatureImage.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });

  const repaired = await Promise.all(
    images.map(async (image) => {
      let publicUrl = image.publicUrl;
      if (isAzureStorageConfigured() && !isSignedBlobUrl(publicUrl)) {
        try {
          publicUrl = await getDurablePublicUrl(image.filename);
          if (publicUrl !== image.publicUrl) {
            await prisma.signatureImage.update({
              where: { id: image.id },
              data: { publicUrl },
            });
          }
        } catch {
          publicUrl = image.publicUrl;
        }
      }
      return {
        ...image,
        publicUrl,
        previewUrl: blobPreviewPath(image.id),
      };
    })
  );

  return NextResponse.json({
    images: repaired,
    storageConfigured: isAzureStorageConfigured(),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthorizedResponse();

  if (!isAzureStorageConfigured()) {
    return NextResponse.json(
      {
        error:
          "Image storage isn't configured.",
      },
      { status: 400 }
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const altText = String(form.get("altText") || "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Image must be 5 MB or smaller" }, { status: 400 });
  }

  const tenant = await getPrimaryTenant();
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadImageToBlob(buffer, file.name, file.type, tenant.id);

  const image = await prisma.signatureImage.create({
    data: {
      tenantId: tenant.id,
      filename: uploaded.blobName,
      originalName: file.name,
      mimeType: file.type,
      size: uploaded.size,
      publicUrl: uploaded.publicUrl,
      altText: altText || null,
      uploadedBy: session.user.email,
    },
  });

  await writeAudit({
    tenantId: tenant.id,
    actorEmail: session.user.email,
    action: "image.uploaded",
    resourceType: "image",
    resourceId: image.id,
    details: { publicUrl: image.publicUrl, size: image.size },
  });

  return NextResponse.json(
    { image: { ...image, previewUrl: blobPreviewPath(image.id) } },
    { status: 201 }
  );
}
