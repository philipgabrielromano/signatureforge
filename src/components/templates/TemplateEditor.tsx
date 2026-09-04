"use client";

import { useCallback, useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { FontFamily } from "@tiptap/extension-font-family";
import { Extension } from "@tiptap/core";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ImageIcon,
  Code2,
  Linkedin,
  Facebook,
  Instagram,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PreviewUserPicker } from "./PreviewUserPicker";
import { SignaturePreview } from "./SignaturePreview";
import { escapeHtmlAttr, findUnsafeImageUrls } from "@/lib/utils";
import { SAMPLE_USER, type UserWithProfile } from "@/lib/variables";
import { toast } from "sonner";

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

const SOCIAL = [
  {
    name: "LinkedIn",
    icon: Linkedin,
    html: '<a href="https://www.linkedin.com/company/contoso"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/linkedin.svg" width="16" height="16" alt="LinkedIn" /></a>',
  },
  {
    name: "X",
    html: '<a href="https://x.com/contoso"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/x.svg" width="16" height="16" alt="X" /></a>',
  },
  {
    name: "Instagram",
    icon: Instagram,
    html: '<a href="https://instagram.com/contoso"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/instagram.svg" width="16" height="16" alt="Instagram" /></a>',
  },
  {
    name: "Facebook",
    icon: Facebook,
    html: '<a href="https://facebook.com/contoso"><img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/facebook.svg" width="16" height="16" alt="Facebook" /></a>',
  },
];

type ImageItem = {
  id: string;
  publicUrl: string;
  previewUrl?: string;
  originalName: string;
  altText?: string | null;
};

export function TemplateEditor({
  initial,
}: {
  initial?: {
    id?: string;
    name: string;
    description?: string | null;
    htmlContent: string;
    version?: number;
    isActive?: boolean;
  };
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [html, setHtml] = useState(initial?.htmlContent ?? "<p>{{fullName}}</p><p>{{title}}</p>");
  const [htmlMode, setHtmlMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [previewUser, setPreviewUser] = useState<UserWithProfile>(SAMPLE_USER);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [imageOpen, setImageOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        hardBreak: { keepMarks: true },
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Image,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Extension.create({
        name: "enterAsBreak",
        priority: 1000,
        addKeyboardShortcuts() {
          return {
            Enter: () => this.editor.commands.setHardBreak(),
            "Shift-Enter": () => this.editor.commands.setHardBreak(),
          };
        },
      }),
    ],
    content: initial?.htmlContent ?? "<p>{{fullName}}</p><p>{{title}}</p>",
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => setHtml(instance.getHTML()),
  });

  useEffect(() => {
    fetch("/api/images")
      .then((r) => r.json())
      .then((data) => setImages(data.images ?? []))
      .catch(() => undefined);
  }, []);

  const insert = useCallback(
    (content: string) => {
      if (htmlMode) {
        setHtml((current) => `${current}${content}`);
        return;
      }
      editor?.chain().focus().insertContent(content).run();
    },
    [editor, htmlMode]
  );

  async function save(deploy: boolean) {
    if (!name.trim()) {
      toast.error("Give the template a name.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        htmlContent: htmlMode ? html : editor?.getHTML() || html,
        deploy,
      };
      const url = initial?.id ? `/api/templates/${initial.id}` : "/api/templates";
      const res = await fetch(url, {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (data.unsafeImageUrls?.length) {
        toast.warning("Saved, but some image URLs aren't public HTTPS.");
      } else {
        toast.success(deploy ? "Saved and queued." : "Draft saved.");
      }
      if (!initial?.id && data.template?.id) {
        window.location.href = `/templates/${data.template.id}`;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const unsafe = findUnsafeImageUrls(html);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Template name</Label>
            <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Corporate Standard" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-desc">Description</Label>
            <Input
              id="template-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Default signature for all staff"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {initial?.version ? <Badge variant="secondary">v{initial.version}</Badge> : null}
          <Button variant="outline" disabled={saving} onClick={() => save(false)}>
            Save draft
          </Button>
          <Button disabled={saving} onClick={() => save(true)}>
            Save &amp; deploy all
          </Button>
        </div>
      </div>

      {unsafe.length > 0 ? (
        <Alert variant="warning">
          <AlertTitle>Images won't load</AlertTitle>
          <AlertDescription>{unsafe.join(", ")}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border bg-card p-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => editor?.chain().focus().toggleBold().run()}>
              <Bold className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => editor?.chain().focus().toggleItalic().run()}>
              <Italic className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => editor?.chain().focus().toggleUnderline().run()}>
              <UnderlineIcon className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => editor?.chain().focus().setTextAlign("left").run()}>
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => editor?.chain().focus().setTextAlign("center").run()}>
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => editor?.chain().focus().setTextAlign("right").run()}>
              <AlignRight className="h-4 w-4" />
            </Button>
            <input
              type="color"
              className="h-8 w-8 cursor-pointer rounded border"
              onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
              aria-label="Text color"
            />
            <Select onValueChange={(value) => editor?.chain().focus().setFontFamily(value).run()}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Font" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Calibri, sans-serif">Calibri</SelectItem>
                <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                <SelectItem value="Georgia, serif">Georgia</SelectItem>
                <SelectItem value="'Segoe UI', sans-serif">Segoe UI</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={(value) => editor?.chain().focus().setMark("textStyle", { fontSize: value }).run()}>
              <SelectTrigger className="w-[90px]"><SelectValue placeholder="Size" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="11px">11</SelectItem>
                <SelectItem value="12px">12</SelectItem>
                <SelectItem value="14px">14</SelectItem>
                <SelectItem value="16px">16</SelectItem>
                <SelectItem value="18px">18</SelectItem>
              </SelectContent>
            </Select>
            <VariableInserter onInsert={insert} />
            <Button type="button" size="sm" variant="outline" onClick={() => setImageOpen(true)}>
              <ImageIcon className="mr-2 h-4 w-4" />
              Image
            </Button>
            {SOCIAL.map((item) => (
              <Button key={item.name} type="button" size="sm" variant="outline" onClick={() => insert(item.html)}>
                {item.name}
              </Button>
            ))}
            <Button type="button" size="sm" variant={htmlMode ? "default" : "outline"} onClick={() => setHtmlMode((v) => !v)}>
              <Code2 className="mr-2 h-4 w-4" />
              HTML
            </Button>
          </div>
          {htmlMode ? (
            <Textarea className="min-h-[420px] font-mono text-xs" value={html} onChange={(e) => setHtml(e.target.value)} />
          ) : (
            <EditorContent editor={editor} className="min-h-[420px] rounded-md border bg-white p-3 prose prose-sm max-w-none" />
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <PreviewUserPicker value={previewUser} onChange={setPreviewUser} />
            <Button variant={previewMode === "desktop" ? "default" : "outline"} size="sm" onClick={() => setPreviewMode("desktop")}>
              Desktop
            </Button>
            <Button variant={previewMode === "mobile" ? "default" : "outline"} size="sm" onClick={() => setPreviewMode("mobile")}>
              Mobile
            </Button>
          </div>
          <SignaturePreview html={html} user={previewUser} mode={previewMode} />
        </div>
      </div>

      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert image</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-80 grid-cols-2 gap-3 overflow-auto sm:grid-cols-3">
            {images.length === 0 ? (
              <p className="col-span-full text-sm text-muted-foreground">No images yet.</p>
            ) : (
              images.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  className="overflow-hidden rounded-md border p-2 text-left hover:border-primary"
                  onClick={() => {
                    insert(
                      `<img src="${escapeHtmlAttr(image.publicUrl)}" alt="${escapeHtmlAttr(image.altText || image.originalName)}" />`
                    );
                    setImageOpen(false);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.previewUrl || image.publicUrl}
                    alt={image.originalName}
                    className="h-16 w-full object-contain"
                  />
                  <p className="mt-1 truncate text-[11px]">{image.originalName}</p>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
