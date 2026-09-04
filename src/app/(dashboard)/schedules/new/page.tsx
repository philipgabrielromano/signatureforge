import { prisma } from "@/lib/prisma";
import { getPrimaryTenant } from "@/lib/tenant";
import { Header } from "@/components/layout/Header";
import { ScheduleForm } from "@/components/schedules/ScheduleForm";

export const dynamic = "force-dynamic";

export default async function NewSchedulePage() {
  const tenant = await getPrimaryTenant();
  const templates = await prisma.template.findMany({
    where: { tenantId: tenant.id, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <Header title="New schedule" subtitle="Overlapping campaigns targeting the same users will warn before save" />
      <div className="p-4 lg:p-8">
        <ScheduleForm templates={templates} />
      </div>
    </>
  );
}
