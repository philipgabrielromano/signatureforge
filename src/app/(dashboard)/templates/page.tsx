import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getPrimaryTenant } from "@/lib/tenant";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { TemplateCard } from "@/components/templates/TemplateCard";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const tenant = await getPrimaryTenant();
  const templates = await prisma.template.findMany({
    where: { tenantId: tenant.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { currentUsers: true, assignments: true } } },
  });

  return (
    <>
      <Header title="Templates" />
      <div className="space-y-6 p-4 lg:p-8">
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/templates/new">New template</Link>
          </Button>
        </div>
        {templates.length === 0 ? (
          <div className="rounded-xl border bg-card py-16 text-center">
            <p className="font-medium">No templates yet</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                id={template.id}
                name={template.name}
                description={template.description}
                htmlContent={template.htmlContent}
                isActive={template.isActive}
                isDefault={template.isDefault}
                updatedAt={template.updatedAt}
                assignedCount={template._count.currentUsers + template._count.assignments}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
