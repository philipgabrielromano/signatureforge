"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function UserSyncButton() {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sync() {
    setOpen(true);
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/users/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setResult(`Added ${data.added}, updated ${data.updated}, unchanged ${data.unchanged}.`);
      toast.success("Synced.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      setResult(message);
      toast.error(message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Button onClick={sync}>
        <RefreshCw className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`} />
        Sync users
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sync users</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {running ? "Syncing…" : result}
          </p>
          {!running && result?.startsWith("Added") ? (
            <Button onClick={() => window.location.reload()}>Refresh table</Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
