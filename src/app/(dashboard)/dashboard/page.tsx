import { Users, FileSignature, CalendarClock, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getPrimaryTenant } from "@/lib/tenant";
import { Header } from "@/components/layout/Header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { PendingSchedules } from "@/components/dashboard/PendingSchedules";
import { DeployProgress } from "@/components/dashboard/DeployProgress";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { UserSyncButton } from "@/components/users/UserSyncButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const tenant = await getPrimaryTenant();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [userCount, deployed24h, activeSchedules, logs, upcoming] = await Promise.all([
    prisma.user.count({ where: { tenantId: tenant.id } }),
    prisma.user.count({
      where: { tenantId: tenant.id, signaturePushStatus: "success", lastSignaturePushedAt: { gte: since } },
    }),
    prisma.schedule.count({ where: { tenantId: tenant.id, status: { in: ["scheduled", "active"] } } }),
    prisma.auditLog.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.schedule.findMany({
      where: { tenantId: tenant.id, status: "scheduled", startAt: { gte: new Date() } },
      include: { template: true },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
  ]);

  return (
    <>
      <Header title="Dashboard" />
      <div className="space-y-6 p-4 lg:p-8">
        <div className="flex flex-wrap gap-2">
          <UserSyncButton />
          <Button asChild variant="outline">
            <Link href="/templates/new">Create template</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard title="Total users" value={String(userCount)} icon={Users} />
          <StatsCard title="Deployed (24h)" value={String(deployed24h)} icon={FileSignature} />
          <StatsCard title="Active schedules" value={String(activeSchedules)} icon={CalendarClock} />
          <StatsCard
            title="Last sync"
            value={tenant.lastSyncAt ? formatDistanceToNow(tenant.lastSyncAt, { addSuffix: true }) : "Never"}
            icon={RefreshCw}
          />
        </div>
        <DeployProgress />
        <div className="grid gap-4 lg:grid-cols-2">
          <RecentActivity logs={logs} />
          <PendingSchedules schedules={upcoming} />
        </div>
      </div>
    </>
  );
}
