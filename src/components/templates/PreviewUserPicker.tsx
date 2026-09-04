"use client";

import { useEffect, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SAMPLE_USER, type UserWithProfile } from "@/lib/variables";
import { cn } from "@/lib/utils";

type UserOption = UserWithProfile & { id: string };

export function PreviewUserPicker({
  value,
  onChange,
}: {
  value: UserWithProfile;
  onChange: (user: UserWithProfile) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: "50" });
      if (query.trim()) params.set("q", query.trim());
      setLoading(true);
      fetch(`/api/users?${params.toString()}`)
        .then((r) => r.json())
        .then((data) => setUsers(data.users ?? []))
        .catch(() => setUsers([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [open, query]);

  const isSample = value.email === SAMPLE_USER.email;
  const label = isSample ? "Alex Rivera (sample)" : value.displayName;
  const q = query.trim().toLowerCase();
  const showSample = !q || "alex rivera sample".includes(q);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[280px] justify-between font-normal">
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] overflow-hidden p-0" align="start">
        <div className="border-b p-2">
          <Input
            autoFocus
            placeholder="Search users"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-64 overflow-y-auto overscroll-contain p-1">
          {showSample ? (
            <button
              type="button"
              className={cn(
                "w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                isSample && "bg-accent"
              )}
              onClick={() => {
                onChange(SAMPLE_USER);
                setOpen(false);
              }}
            >
              Alex Rivera (sample)
            </button>
          ) : null}
          {loading && users.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Searching…</p>
          ) : users.length === 0 && q ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No matches</p>
          ) : (
            users.map((user) => (
              <button
                key={user.id}
                type="button"
                className={cn(
                  "flex w-full flex-col rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                  value.email === user.email && "bg-accent"
                )}
                onClick={() => {
                  onChange(user);
                  setOpen(false);
                }}
              >
                <span className="truncate">{user.displayName}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
