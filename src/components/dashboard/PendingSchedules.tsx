import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PendingSchedules({
  schedules,
}: {
  schedules: Array<{
    id: string;
    name: string;
    status: string;
    startAt: Date;
    template: { name: string };
  }>;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Upcoming schedules</CardTitle>
        <Link href="/schedules" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming campaigns. Holiday and event signatures are scheduled here.</p>
        ) : (
          schedules.map((schedule) => (
            <div key={schedule.id} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
              <div>
                <p className="text-sm font-medium">{schedule.name}</p>
                <p className="text-xs text-muted-foreground">{schedule.template.name}</p>
              </div>
              <div className="text-right">
                <Badge variant="warning">{schedule.status}</Badge>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDistanceToNow(schedule.startAt, { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
