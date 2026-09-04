"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AssignmentModal } from "./AssignmentModal";

type UserRow = {
  id: string;
  displayName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  signaturePushStatus: string;
  signaturePushError: string | null;
  lastSignaturePushedAt: string | null;
  currentSignature: { id: string; name: string } | null;
};

function statusBadge(status: string) {
  if (status === "success") return <Badge variant="success">Success</Badge>;
  if (status === "failed") return <Badge variant="danger">Failed</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

export function UserTable({
  users,
  departments,
  templates,
}: {
  users: UserRow[];
  departments: string[];
  templates: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<UserRow | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const filtered = useMemo(
    () =>
      users.filter((user) => {
        const q = query.toLowerCase();
        const matchesQuery =
          !q ||
          user.displayName.toLowerCase().includes(q) ||
          user.email.toLowerCase().includes(q);
        const matchesDept = department === "all" || user.department === department;
        const matchesStatus = status === "all" || user.signaturePushStatus === status;
        return matchesQuery && matchesDept && matchesStatus;
      }),
    [users, query, department, status]
  );

  async function deploy(ids: string[]) {
    const res = await fetch("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: ids, immediate: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Deploy failed");
      return;
    }
    toast.success(`Processed ${data.processed} mailbox${data.processed === 1 ? "" : "es"}.`);
    window.location.reload();
  }

  async function retry(userId: string) {
    const res = await fetch(`/api/deploy/${userId}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Retry failed");
      return;
    }
    toast.message(data.user?.signaturePushStatus === "success" ? "Signature pushed." : data.user?.signaturePushError);
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          placeholder="Search name or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-sm"
        />
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!selected.length} onClick={() => setAssignOpen(true)}>
            Assign
          </Button>
          <Button disabled={!selected.length} onClick={() => deploy(selected)}>
            Deploy
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={filtered.length > 0 && selected.length === filtered.length}
                  onCheckedChange={(checked) =>
                    setSelected(checked ? filtered.map((u) => u.id) : [])
                  }
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Last pushed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  No users match these filters. Sync from Azure AD or seed the database.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => (
                <TableRow key={user.id} className="cursor-pointer" onClick={() => setDrawer(user)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.includes(user.id)}
                      onCheckedChange={(checked) =>
                        setSelected((current) =>
                          checked ? [...current, user.id] : current.filter((id) => id !== user.id)
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">{user.displayName}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.department || "—"}</TableCell>
                  <TableCell>{user.jobTitle || "—"}</TableCell>
                  <TableCell>{user.currentSignature?.name || "Unassigned"}</TableCell>
                  <TableCell>
                    {user.lastSignaturePushedAt
                      ? formatDistanceToNow(new Date(user.lastSignaturePushedAt), { addSuffix: true })
                      : "Never"}
                  </TableCell>
                  <TableCell>{statusBadge(user.signaturePushStatus)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {user.signaturePushStatus === "failed" ? (
                      <Button size="sm" variant="outline" onClick={() => retry(user.id)}>
                        Retry
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={Boolean(drawer)} onOpenChange={(open) => !open && setDrawer(null)}>
        <SheetContent>
          {drawer ? (
            <div className="space-y-4">
              <SheetHeader>
                <SheetTitle>{drawer.displayName}</SheetTitle>
              </SheetHeader>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground">Email</p><p>{drawer.email}</p></div>
                <div><p className="text-muted-foreground">Department</p><p>{drawer.department || "—"}</p></div>
                <div><p className="text-muted-foreground">Title</p><p>{drawer.jobTitle || "—"}</p></div>
                <div><p className="text-muted-foreground">Template</p><p>{drawer.currentSignature?.name || "Unassigned"}</p></div>
              </dl>
              {drawer.signaturePushError ? (
                <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{drawer.signaturePushError}</p>
              ) : null}
              <Button onClick={() => retry(drawer.id)}>Push signature now</Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <AssignmentModal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        templates={templates}
        userIds={selected}
      />
    </div>
  );
}
