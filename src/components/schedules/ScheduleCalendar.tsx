"use client";

import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ScheduleItem = {
  id: string;
  name: string;
  status: string;
  startAt: string;
  endAt: string | null;
  template: { name: string };
};

function statusVariant(status: string) {
  if (status === "active") return "success" as const;
  if (status === "cancelled") return "secondary" as const;
  if (status === "completed") return "outline" as const;
  return "warning" as const;
}

export function ScheduleCalendar({ schedules }: { schedules: ScheduleItem[] }) {
  const [month, setMonth] = useState(new Date());
  const daysWithEvents = useMemo(
    () => schedules.map((s) => new Date(s.startAt)),
    [schedules]
  );

  async function cancel(id: string) {
    const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not cancel schedule");
      return;
    }
    toast.success("Schedule cancelled");
    window.location.reload();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            month={month}
            onMonthChange={setMonth}
            modifiers={{ scheduled: daysWithEvents }}
            modifiersClassNames={{ scheduled: "bg-indigo-100 text-indigo-900 font-semibold" }}
          />
        </CardContent>
      </Card>
      <div className="space-y-3">
        {schedules.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No schedules yet.
            </CardContent>
          </Card>
        ) : (
          schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{schedule.name}</p>
                    <Badge variant={statusVariant(schedule.status)}>{schedule.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {schedule.template.name} · starts {format(new Date(schedule.startAt), "PPp")}
                    {schedule.endAt ? ` · ends ${format(new Date(schedule.endAt), "PPp")}` : ""}
                  </p>
                </div>
                {schedule.status === "scheduled" || schedule.status === "active" ? (
                  <Button variant="outline" size="sm" onClick={() => cancel(schedule.id)}>
                    Cancel
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
