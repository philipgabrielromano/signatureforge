"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ImageUploader({ disabled, onUploaded }: { disabled?: boolean; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function upload(selected = file) {
    if (!selected) {
      toast.error("Choose an image first.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", selected);
      form.append("altText", alt);
      const res = await fetch("/api/images", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      toast.success("Uploaded to Azure Blob Storage.");
      setFile(null);
      setAlt("");
      onUploaded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className={`rounded-xl border border-dashed p-6 ${dragging ? "border-primary bg-indigo-50" : "bg-card"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) setFile(dropped);
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_auto] sm:items-end">
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="image-file">Image file</Label>
          <Input
            id="image-file"
            type="file"
            className="file:mr-3"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            disabled={disabled || uploading}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="alt">Alt text</Label>
          <Input
            id="alt"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            disabled={disabled}
            placeholder="Company logo"
          />
        </div>
        <Button disabled={disabled || uploading} onClick={() => upload()}>
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        PNG, JPEG, GIF, WebP, or SVG. Max 5 MB. Files are stored in Azure Blob Storage with a durable read URL so
        Outlook can fetch them. Render disk is never used.
      </p>
      {file ? <p className="mt-2 text-sm text-muted-foreground">Selected: {file.name}</p> : null}
    </div>
  );
}
