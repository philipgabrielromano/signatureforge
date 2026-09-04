"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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
  const [targetType, setTargetType] = useState("department");
  const [targetValue, setTargetValue] = useState("");
  const [priority, setPriority] = useState("0");

  async function create() {
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
    toast.success("Assignment saved. Matching users are pending injection.");
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-5">
        <div className="space-y-1.5 md:col-span-2">
          <Label>Template</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <p className="text-sm font-medium">Org-wide</p>
            <Switch checked={orgWide} onCheckedChange={setOrgWide} />
          </div>
        </div>
        {!orgWide ? (
          <>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={targetType} onValueChange={setTargetType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Value</Label>
              <Input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="IT" />
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} />
          </div>
        )}
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
                  No assignments yet. Org-wide Corporate Standard is a good first rule.
                </TableCell>
              </TableRow>
            ) : (
              assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">{assignment.template.name}</TableCell>
                  <TableCell>
                    {assignment.isOrgWide
                      ? "Entire organization"
                      : `${assignment.targetType}: ${assignment.targetValue}`}
                  </TableCell>
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
