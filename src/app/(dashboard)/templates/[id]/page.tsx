import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/Header";
import { TemplateEditor } from "@/components/templates/TemplateEditor";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const template = await prisma.template.findUnique({ where: { id: params.id } });
  if (!template) notFound();

  return (
    <>
      <Header title={template.name} />
      <div className="p-4 lg:p-8">
        <TemplateEditor
          initial={{
            id: template.id,
            name: template.name,
            description: template.description,
            htmlContent: template.htmlContent,
            version: template.version,
            isActive: template.isActive,
          }}
        />
      </div>
    </>
  );
}
