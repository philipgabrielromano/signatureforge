"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SettingsForm({
  tenant,
  graphConfigured,
  storageConfigured,
  storage,
}: {
  tenant: {
    name: string;
    domain: string;
    azureClientId: string;
    azureTenantId: string;
    syncEnabled: boolean;
    syncFrequencyMinutes: number;
    autoDeployOnSave: boolean;
    deployBatchSize: number;
  };
  graphConfigured: boolean;
  storageConfigured: boolean;
  storage: { accountName: string; containerName: string; publicUrl: string };
}) {
  const [name, setName] = useState(tenant.name);
  const [domain, setDomain] = useState(tenant.domain);
  const [azureClientId, setAzureClientId] = useState(tenant.azureClientId);
  const [azureTenantId, setAzureTenantId] = useState(tenant.azureTenantId);
  const [azureClientSecret, setAzureClientSecret] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(tenant.syncEnabled);
  const [syncFrequency, setSyncFrequency] = useState(String(tenant.syncFrequencyMinutes));
  const [autoDeploy, setAutoDeploy] = useState(tenant.autoDeployOnSave);
  const [batchSize, setBatchSize] = useState(String(tenant.deployBatchSize));

  async function save(extra: Record<string, unknown> = {}) {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        domain,
        azureClientId,
        azureTenantId,
        azureClientSecret: azureClientSecret || undefined,
        syncEnabled,
        syncFrequencyMinutes: Number(syncFrequency),
        autoDeployOnSave: autoDeploy,
        deployBatchSize: Number(batchSize),
        ...extra,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Save failed");
      return;
    }
    toast.success("Settings saved");
  }

  async function test(kind: "graph" | "storage") {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: kind }),
    });
    const data = await res.json();
    if (data.ok) toast.success(data.message);
    else toast.error(data.message || "Connection failed");
  }

  return (
    <div className="grid max-w-4xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Azure AD integration</CardTitle>
          <CardDescription>
            Application (client) credentials used for Graph user sync and mailbox injection. Admin UI login uses the
            AZURE_AD_* environment variables on Render.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Status</Label>
            <p className="text-sm text-muted-foreground">
              {graphConfigured ? "Graph credentials look populated." : "Placeholder credentials — injection will fail until you add a real app registration."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Application (client) ID</Label>
            <Input value={azureClientId} onChange={(e) => setAzureClientId(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Directory (tenant) ID</Label>
            <Input value={azureTenantId} onChange={(e) => setAzureTenantId(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Client secret</Label>
            <Input type="password" value={azureClientSecret} onChange={(e) => setAzureClientSecret(e.target.value)} placeholder="Unchanged if left blank" />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => save()}>Save credentials</Button>
            <Button type="button" variant="outline" onClick={() => test("graph")}>
              Test connection
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Directory sync</CardTitle>
          <CardDescription>The Render cron job runs every 5 minutes and syncs when this interval has elapsed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Automatic sync</p>
              <p className="text-xs text-muted-foreground">Pull users from Microsoft Graph.</p>
            </div>
            <Switch checked={syncEnabled} onCheckedChange={setSyncEnabled} />
          </div>
          <div className="max-w-xs space-y-1.5">
            <Label>Frequency</Label>
            <Select value={syncFrequency} onValueChange={setSyncFrequency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="15">Every 15 minutes</SelectItem>
                <SelectItem value="30">Every 30 minutes</SelectItem>
                <SelectItem value="60">Every hour</SelectItem>
                <SelectItem value="240">Every 4 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => save()}>Save sync settings</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signature push</CardTitle>
          <CardDescription>Injection is a mailbox API write. Never a transport rule, connector, or journal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-deploy on save</p>
              <p className="text-xs text-muted-foreground">Mark assigned users pending when a template is saved.</p>
            </div>
            <Switch checked={autoDeploy} onCheckedChange={setAutoDeploy} />
          </div>
          <div className="max-w-xs space-y-1.5">
            <Label>Batch size per cron tick</Label>
            <Input type="number" min={1} max={200} value={batchSize} onChange={(e) => setBatchSize(e.target.value)} />
          </div>
          <Button onClick={() => save()}>Save push settings</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Azure Blob Storage</CardTitle>
          <CardDescription>
            These values come from Render environment variables. The container must allow anonymous blob read so Outlook can load images.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Account: {storage.accountName || "not set"}</p>
          <p>Container: {storage.containerName || "not set"}</p>
          <p className="break-all">Public URL: {storage.publicUrl || "not set"}</p>
          <p className="text-muted-foreground">
            {storageConfigured ? "Credentials are present." : "Not configured — image uploads are disabled."}
          </p>
          <Button type="button" variant="outline" onClick={() => test("storage")}>
            Test connection
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tenant</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Primary domain</Label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
          </div>
          <Button onClick={() => save()}>Save tenant</Button>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>These actions do not call Microsoft Graph. They only reset local assignment and sync state.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="destructive" onClick={() => save({ danger: "reset-assignments" })}>
            Reset assignments
          </Button>
          <Button variant="outline" onClick={() => save({ danger: "clear-sync" })}>
            Clear last sync timestamp
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
