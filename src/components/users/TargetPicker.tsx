"use client";

import { useEffect, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DirectoryKind = "user" | "department" | "group";

type Item = { id: string; label: string; description?: string | null };

const PLACEHOLDERS: Record<DirectoryKind, string> = {
  user: "Search users",
  department: "Search departments",
  group: "Search groups",
};

export function TargetPicker({
  kind,
  value,
  label,
  onChange,
}: {
  kind: DirectoryKind;
  value: string;
  label?: string;
  onChange: (value: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams({
        kind: kind === "user" ? "users" : kind === "group" ? "groups" : "departments",
        limit: "50",
      });
      if (query.trim()) params.set("q", query.trim());
      setLoading(true);
      fetch(`/api/directory?${params.toString()}`)
        .then((r) => r.json())
        .then((data) => setItems(data.items ?? []))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [open, query, kind]);

  useEffect(() => {
    setQuery("");
    setItems([]);
  }, [kind]);

  const display = label || value || `Choose ${kind}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          <span className="truncate">{display}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0" align="start">
        <div className="border-b p-2">
          <Input
            autoFocus
            placeholder={PLACEHOLDERS[kind]}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-64 overflow-y-auto overscroll-contain p-1">
          {loading && items.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Searching…</p>
          ) : items.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No matches</p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                  value === item.id && "bg-accent"
                )}
                onClick={() => {
                  onChange(item.id, item.label);
                  setOpen(false);
                }}
              >
                <span className="truncate">{item.label}</span>
                {item.description && item.description !== item.label ? (
                  <span className="truncate text-xs text-muted-foreground">{item.description}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
