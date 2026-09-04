import { prisma } from "@/lib/prisma";
import { getPrimaryTenant } from "@/lib/tenant";
import { Header } from "@/components/layout/Header";
import { AssignmentsClient } from "@/components/users/AssignmentsClient";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const tenant = await getPrimaryTenant();
  const [assignments, templates] = await Promise.all([
    prisma.assignment.findMany({
      where: { tenantId: tenant.id },
      include: { template: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    }),
    prisma.template.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <Header title="Assignments" />
      <div className="p-4 lg:p-8">
        <AssignmentsClient
          assignments={assignments.map((a) => ({
            id: a.id,
            isOrgWide: a.isOrgWide,
            targetType: a.targetType,
            targetValue: a.targetValue,
            priority: a.priority,
            isActive: a.isActive,
            template: { id: a.template.id, name: a.template.name },
          }))}
          templates={templates}
        />
      </div>
    </>
  );
}
