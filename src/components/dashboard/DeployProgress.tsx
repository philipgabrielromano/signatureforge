"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export function DeployProgress({ autoStart }: { autoStart?: boolean }) {
  const [status, setStatus] = useState<{ pending: number; success: number; failed: number; total: number } | null>(null);
  const [running, setRunning] = useState(false);

  async function poll() {
    const res = await fetch("/api/deploy/status");
    if (res.ok) setStatus(await res.json());
  }

  useEffect(() => {
    void poll();
    const id = setInterval(() => void poll(), 4000);
    return () => clearInterval(id);
  }, []);

  async function deployAll() {
    setRunning(true);
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ immediate: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deploy failed");
      toast.success(`Deployed ${data.succeeded}. Remaining: ${data.remaining}.`);
      await poll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Deploy failed");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (autoStart) void deployAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const total = status?.total || 0;
  const successPct = total ? Math.round(((status?.success || 0) / total) * 100) : 0;
  const pendingPct = total ? Math.round(((status?.pending || 0) / total) * 100) : 0;
  const failedPct = total ? Math.round(((status?.failed || 0) / total) * 100) : 0;

  return (
    <div className="space-y-3 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Signatures</p>
        </div>
        <Button size="sm" disabled={running} onClick={deployAll}>
          {running ? "Deploying…" : "Deploy all"}
        </Button>
      </div>
      <div className="space-y-2">
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="bg-emerald-500" style={{ width: `${successPct}%` }} />
          <div className="bg-amber-400" style={{ width: `${pendingPct}%` }} />
          <div className="bg-red-500" style={{ width: `${failedPct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          {status?.success ?? 0} success · {status?.pending ?? 0} pending · {status?.failed ?? 0} failed
        </p>
      </div>
      <Progress value={successPct} />
    </div>
  );
}
