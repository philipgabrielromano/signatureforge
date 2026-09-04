"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TargetPicker, type DirectoryKind } from "./TargetPicker";

type AssignmentRow = {
  id: string;
  isOrgWide: boolean;
  targetType: string | null;
  targetValue: string | null;
  priority: number;
  isActive: boolean;
  template: { id: string; name: string };
};

export function AssignmentsClient({
  assignments,
  templates,
}: {
  assignments: AssignmentRow[];
  templates: { id: string; name: string }[];
}) {
  const [templateId, setTemplateId] = useState("");
  const [orgWide, setOrgWide] = useState(true);
  const [targetType, setTargetType] = useState<DirectoryKind>("department");
  const [targetValue, setTargetValue] = useState("");
  const [targetLabel, setTargetLabel] = useState("");
  const [priority, setPriority] = useState("0");
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = assignments
      .filter((assignment) => assignment.targetType === "group" && assignment.targetValue)
      .map((assignment) => assignment.targetValue as string);
    if (ids.length === 0) return;
    fetch(`/api/directory?kind=groups&ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then((data) => {
        const next: Record<string, string> = {};
        for (const item of data.items ?? []) next[item.id] = item.label;
        setGroupNames(next);
      })
      .catch(() => undefined);
  }, [assignments]);

  async function create() {
    if (!templateId) {
      toast.error("Choose a template.");
      return;
    }
    if (!orgWide && !targetValue) {
      toast.error("Choose a target.");
      return;
    }
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId,
        isOrgWide: orgWide,
        targetType: orgWide ? null : targetType,
        targetValue: orgWide ? null : targetValue,
        priority: Number(priority),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not create assignment");
      return;
    }
    toast.success("Assignment saved.");
    window.location.reload();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/assignments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete assignment");
      return;
    }
    toast.success("Assignment removed");
    window.location.reload();
  }

  function targetDisplay(assignment: AssignmentRow) {
    if (assignment.isOrgWide) return "Entire organization";
    if (assignment.targetType === "group") {
      const name = assignment.targetValue ? groupNames[assignment.targetValue] : null;
      return name ? `group: ${name}` : `group: ${assignment.targetValue}`;
    }
    return `${assignment.targetType}: ${assignment.targetValue}`;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="space-y-1.5 md:col-span-2">
          <Label>Template</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <div>
            <p className="text-sm font-medium">Org-wide</p>
            <Switch checked={orgWide} onCheckedChange={setOrgWide} />
          </div>
        </div>
        {!orgWide ? (
          <>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={targetType}
                onValueChange={(value) => {
                  setTargetType(value as DirectoryKind);
                  setTargetValue("");
                  setTargetLabel("");
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Target</Label>
              <TargetPicker
                kind={targetType}
                value={targetValue}
                label={targetLabel}
                onChange={(nextValue, nextLabel) => {
                  setTargetValue(nextValue);
                  setTargetLabel(nextLabel);
                }}
              />
            </div>
          </>
        ) : null}
        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button onClick={create}>Add assignment</Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No assignments yet.
                </TableCell>
              </TableRow>
            ) : (
              assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">{assignment.template.name}</TableCell>
                  <TableCell>{targetDisplay(assignment)}</TableCell>
                  <TableCell>{assignment.priority}</TableCell>
                  <TableCell>
                    <Badge variant={assignment.isActive ? "success" : "secondary"}>
                      {assignment.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => remove(assignment.id)}>
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
