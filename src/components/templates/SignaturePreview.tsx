"use client";

import { SAMPLE_USER, resolveVariables, type UserWithProfile } from "@/lib/variables";
import { cn } from "@/lib/utils";

export function SignaturePreview({
  html,
  user = SAMPLE_USER,
  mode = "desktop",
}: {
  html: string;
  user?: UserWithProfile;
  mode?: "desktop" | "mobile";
}) {
  const resolved = resolveVariables(html, user);

  return (
    <div className="rounded-lg border bg-slate-100 p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Preview</span>
        <span className="uppercase tracking-wide">{mode}</span>
      </div>
      <div
        className={cn(
          "mx-auto rounded-md border bg-white p-4 shadow-sm",
          mode === "mobile" ? "max-w-[340px]" : "max-w-2xl"
        )}
      >
        <div className="mb-4 space-y-2 text-sm text-slate-400">
          <div>To: partner@northwind.com</div>
          <div>Subject: Q4 campaign assets</div>
        </div>
        <div className="mb-6 text-sm text-slate-700">Hi team, sharing the latest signature rollout notes.</div>
        <div
          className="border-t pt-3 text-[13px] leading-relaxed text-slate-800 [&_img]:max-h-16 [&_img.sig-icon]:max-h-4"
          dangerouslySetInnerHTML={{ __html: resolved }}
        />
      </div>
    </div>
  );
}
