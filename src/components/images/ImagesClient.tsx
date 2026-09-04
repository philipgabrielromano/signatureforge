"use client";

import { useEffect, useState } from "react";
import { ImageUploader } from "./ImageUploader";
import { ImageLibrary } from "./ImageLibrary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ImagesClient({
  initialImages,
  storageConfigured,
}: {
  initialImages: Array<{
    id: string;
    originalName: string;
    publicUrl: string;
    previewUrl?: string;
    size: number;
    mimeType: string;
  }>;
  storageConfigured: boolean;
}) {
  const [images, setImages] = useState(initialImages);

  async function refresh() {
    const res = await fetch("/api/images");
    const data = await res.json();
    setImages(data.images ?? []);
  }

  useEffect(() => {
    setImages(initialImages);
  }, [initialImages]);

  return (
    <div className="space-y-6">
      {!storageConfigured ? (
        <Alert variant="warning">
          <AlertTitle>Image storage isn't configured</AlertTitle>
          <AlertDescription>Uploads are disabled until storage is set in Settings.</AlertDescription>
        </Alert>
      ) : null}
      <ImageUploader disabled={!storageConfigured} onUploaded={refresh} />
      <ImageLibrary images={images} onChanged={refresh} />
    </div>
  );
}
