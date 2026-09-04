"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SAMPLE_USER, resolveVariables } from "@/lib/variables";

type TemplateCardProps = {
  id: string;
  name: string;
  description?: string | null;
  htmlContent: string;
  isActive: boolean;
  isDefault: boolean;
  updatedAt: string | Date;
  assignedCount: number;
};

export function TemplateCard({
  id,
  name,
  description,
  htmlContent,
  isActive,
  isDefault,
  updatedAt,
  assignedCount,
}: TemplateCardProps) {
  const previewHtml = resolveVariables(htmlContent, SAMPLE_USER);

  return (
    <Link href={`/templates/${id}`}>
      <Card className="h-full overflow-hidden transition hover:border-primary/40 hover:shadow-md">
        <div className="h-36 overflow-hidden border-b bg-white p-3">
          <div
            className="origin-top-left scale-[0.72] text-[12px] leading-snug text-slate-800 [&_img]:max-h-12 [&_p]:m-0"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
        <CardHeader className="space-y-2 pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{name}</CardTitle>
            <div className="flex gap-1">
              {isDefault ? <Badge>Default</Badge> : null}
              <Badge variant={isActive ? "success" : "secondary"}>{isActive ? "Active" : "Inactive"}</Badge>
            </div>
          </div>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {assignedCount} assigned · updated {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
        </CardContent>
      </Card>
    </Link>
  );
}
