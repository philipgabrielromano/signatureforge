"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AssignmentModal({
  open,
  onOpenChange,
  templates,
  userIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: { id: string; name: string }[];
  userIds: string[];
}) {
  const [templateId, setTemplateId] = useState("");
  const [saving, setSaving] = useState(false);

  async function assign() {
    if (!templateId) {
      toast.error("Choose a template.");
      return;
    }
    setSaving(true);
    try {
      for (const userId of userIds) {
        const res = await fetch("/api/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId,
            isOrgWide: false,
            targetType: "user",
            targetValue: userId,
            priority: 50,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Assignment failed");
        }
      }
      toast.success(`Assigned template to ${userIds.length} user${userIds.length === 1 ? "" : "s"}.`);
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Assignment failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign signature template</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {userIds.length} selected user{userIds.length === 1 ? "" : "s"} will receive this template on the next mailbox push.
          </p>
          <div className="space-y-1.5">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Choose a template" /></SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button disabled={saving} onClick={assign}>Create assignments</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
