"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Log = {
  id: string;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: unknown;
  createdAt: string;
};

export function AuditClient({ initialLogs, initialTotal }: { initialLogs: Log[]; initialTotal: number }) {
  const [logs, setLogs] = useState(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  async function load(nextPage = 1) {
    const params = new URLSearchParams({ page: String(nextPage), pageSize: "25" });
    if (action) params.set("action", action);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    const res = await fetch(`/api/audit?${params.toString()}`);
    const data = await res.json();
    setLogs(data.logs ?? []);
    setTotal(data.total ?? 0);
    setPage(nextPage);
  }

  function exportCsv() {
    const params = new URLSearchParams({ format: "csv" });
    if (action) params.set("action", action);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    window.location.href = `/api/audit?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row">
        <Input placeholder="Filter by action" value={action} onChange={(e) => setAction(e.target.value)} className="max-w-xs" />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button variant="outline" onClick={() => load(1)}>Apply</Button>
        <Button onClick={exportCsv}>Export CSV</Button>
      </div>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No audit events in this range.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{format(new Date(log.createdAt), "PPp")}</TableCell>
                  <TableCell>{log.actorEmail}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>
                    {log.resourceType}
                    {log.resourceId ? ` · ${log.resourceId.slice(0, 8)}` : ""}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {log.details ? JSON.stringify(log.details) : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          Page {page} · {total} events
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => load(page - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page * 25 >= total} onClick={() => load(page + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
