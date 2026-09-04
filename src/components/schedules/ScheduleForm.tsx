"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TargetPicker, type DirectoryKind } from "@/components/users/TargetPicker";

export function ScheduleForm({
  templates,
}: {
  templates: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [revertTemplateId, setRevertTemplateId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [orgWide, setOrgWide] = useState(true);
  const [targetType, setTargetType] = useState<DirectoryKind>("department");
  const [targetValue, setTargetValue] = useState("");
  const [targetLabel, setTargetLabel] = useState("");
  const [conflicts, setConflicts] = useState<{ id: string; name: string }[] | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(override = false) {
    setSaving(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          templateId,
          revertTemplateId: revertTemplateId || null,
          startAt: new Date(startAt).toISOString(),
          endAt: endAt ? new Date(endAt).toISOString() : null,
          isOrgWide: orgWide,
          targetType: orgWide ? null : targetType,
          targetValue: orgWide ? null : targetValue,
          overrideConflicts: override,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setConflicts(data.conflicts ?? []);
        toast.warning("This campaign overlaps an existing schedule.");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Could not create schedule");
      toast.success("Schedule created.");
      router.push("/schedules");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create schedule");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="max-w-2xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="sched-name">Campaign name</Label>
        <Input id="sched-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday 2026" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sched-desc">Description</Label>
        <Textarea id="sched-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Signature template</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Revert to</Label>
          <Select value={revertTemplateId} onValueChange={setRevertTemplateId}>
            <SelectTrigger><SelectValue placeholder="After the campaign ends" /></SelectTrigger>
            <SelectContent>
              {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="start">Start</Label>
          <Input id="start" type="datetime-local" required value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end">End (optional)</Label>
          <Input id="end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Organization-wide</p>
        </div>
        <Switch checked={orgWide} onCheckedChange={setOrgWide} />
      </div>
      {!orgWide ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Target type</Label>
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
          <div className="space-y-1.5">
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
        </div>
      ) : null}

      {conflicts ? (
        <Alert variant="warning">
          <AlertTitle>Overlapping campaigns</AlertTitle>
          <AlertDescription>
            {conflicts.map((c) => c.name).join(", ") || "Another schedule targets the same users."}
            <div className="mt-3">
              <Button type="button" variant="outline" onClick={() => submit(true)}>
                Create anyway
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={saving}>Create schedule</Button>
    </form>
  );
}
