import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/layout/Header";
import { SignaturePreview } from "@/components/templates/SignaturePreview";

export const dynamic = "force-dynamic";

export default async function TemplatePreviewPage({ params }: { params: { id: string } }) {
  const template = await prisma.template.findUnique({ where: { id: params.id } });
  if (!template) notFound();

  return (
    <>
      <Header title={`Preview · ${template.name}`} subtitle="Exact HTML that will be written to Exchange" />
      <div className="space-y-6 p-4 lg:p-8">
        <SignaturePreview html={template.htmlContent} mode="desktop" />
        <SignaturePreview html={template.htmlContent} mode="mobile" />
      </div>
    </>
  );
}
