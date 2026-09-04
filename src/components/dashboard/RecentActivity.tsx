import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RecentActivity({
  logs,
}: {
  logs: Array<{
    id: string;
    action: string;
    actorEmail: string;
    createdAt: Date;
    resourceType: string;
  }>;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit events yet. Saving a template or syncing users will show up here.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
              <div>
                <p className="text-sm font-medium">{log.action}</p>
                <p className="text-xs text-muted-foreground">
                  {log.actorEmail} · {log.resourceType}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(log.createdAt, { addSuffix: true })}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
