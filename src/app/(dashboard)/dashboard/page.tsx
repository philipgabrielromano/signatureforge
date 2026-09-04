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
      <Header title="Dashboard" subtitle="Mailbox signature health across Microsoft 365" />
      <div className="space-y-6 p-4 lg:p-8">
        <div className="flex flex-wrap gap-2">
          <UserSyncButton />
          <Button asChild variant="outline">
            <Link href="/templates/new">Create template</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard title="Total users" value={String(userCount)} hint="Synced from Azure AD" icon={Users} />
          <StatsCard
            title="Signatures deployed (24h)"
            value={String(deployed24h)}
            hint="Successful Graph/EWS writes"
            icon={FileSignature}
          />
          <StatsCard
            title="Active schedules"
            value={String(activeSchedules)}
            hint="Campaigns waiting or live"
            icon={CalendarClock}
          />
          <StatsCard
            title="Last directory sync"
            value={tenant.lastSyncAt ? formatDistanceToNow(tenant.lastSyncAt, { addSuffix: true }) : "Never"}
            hint={tenant.syncEnabled ? `Every ${tenant.syncFrequencyMinutes} min` : "Auto-sync off"}
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
