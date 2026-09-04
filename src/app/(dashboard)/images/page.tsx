import { prisma } from "@/lib/prisma";
import { getPrimaryTenant } from "@/lib/tenant";
import { blobPreviewPath, isAzureStorageConfigured } from "@/lib/azureBlob";
import { Header } from "@/components/layout/Header";
import { ImagesClient } from "@/components/images/ImagesClient";

export const dynamic = "force-dynamic";

export default async function ImagesPage() {
  const tenant = await getPrimaryTenant();
  const images = await prisma.signatureImage.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <Header title="Image library" />
      <div className="p-4 lg:p-8">
        <ImagesClient
          storageConfigured={isAzureStorageConfigured()}
          initialImages={images.map((image) => ({
            id: image.id,
            originalName: image.originalName,
            publicUrl: image.publicUrl,
            previewUrl: blobPreviewPath(image.id),
            size: image.size,
            mimeType: image.mimeType,
          }))}
        />
      </div>
    </>
  );
}
