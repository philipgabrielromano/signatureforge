import { prisma } from "@/lib/prisma";
import { getPrimaryTenant } from "@/lib/tenant";
import { Header } from "@/components/layout/Header";
import { ScheduleCalendar } from "@/components/schedules/ScheduleCalendar";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SchedulesPage() {
  const tenant = await getPrimaryTenant();
  const schedules = await prisma.schedule.findMany({
    where: { tenantId: tenant.id },
    include: { template: true },
    orderBy: { startAt: "asc" },
  });

  return (
    <>
      <Header title="Schedules" />
      <div className="space-y-4 p-4 lg:p-8">
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/schedules/new">New schedule</Link>
          </Button>
        </div>
        <ScheduleCalendar
          schedules={schedules.map((s) => ({
            id: s.id,
            name: s.name,
            status: s.status,
            startAt: s.startAt.toISOString(),
            endAt: s.endAt?.toISOString() ?? null,
            template: { name: s.template.name },
          }))}
        />
      </div>
    </>
  );
}
