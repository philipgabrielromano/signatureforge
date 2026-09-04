"use client";

import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ImageItem = {
  id: string;
  originalName: string;
  publicUrl: string;
  previewUrl?: string;
  size: number;
  mimeType: string;
};

export function ImageLibrary({
  images,
  onChanged,
}: {
  images: ImageItem[];
  onChanged: () => void;
}) {
  async function copy(url: string) {
    await navigator.clipboard.writeText(url);
    toast.success("Public Azure URL copied.");
  }

  async function remove(id: string) {
    const res = await fetch(`/api/images/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || "Delete failed");
      return;
    }
    toast.success("Deleted from Azure Blob and the library.");
    onChanged();
  }

  if (images.length === 0) {
    return (
      <div className="rounded-xl border bg-card py-12 text-center text-sm text-muted-foreground">
        No signature images yet. Upload logos, banners, and social icons here so templates can embed absolute HTTPS URLs.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {images.map((image) => (
        <div key={image.id} className="overflow-hidden rounded-xl border bg-card">
          <div className="flex h-36 items-center justify-center bg-slate-50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.previewUrl || `/api/images/${image.id}/file`}
              alt={image.originalName}
              className="max-h-28 object-contain"
            />
          </div>
          <div className="space-y-2 p-3">
            <p className="truncate text-sm font-medium">{image.originalName}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(image.size)} · {image.mimeType}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(image.publicUrl)}>
                Copy URL
              </Button>
              <Button size="sm" variant="destructive" onClick={() => remove(image.id)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
