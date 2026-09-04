import { prisma } from "@/lib/prisma";
import { getPrimaryTenant } from "@/lib/tenant";
import { Header } from "@/components/layout/Header";
import { AuditClient } from "@/components/dashboard/AuditClient";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const tenant = await getPrimaryTenant();
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.auditLog.count({ where: { tenantId: tenant.id } }),
  ]);

  return (
    <>
      <Header title="Audit log" subtitle="Every template change, sync, and mailbox injection attempt" />
      <div className="p-4 lg:p-8">
        <AuditClient
          initialLogs={logs.map((log) => ({
            id: log.id,
            actorEmail: log.actorEmail,
            action: log.action,
            resourceType: log.resourceType,
            resourceId: log.resourceId,
            details: log.details,
            createdAt: log.createdAt.toISOString(),
          }))}
          initialTotal={total}
        />
      </div>
    </>
  );
}
