import { Header } from "@/components/layout/Header";
import { TemplateEditor } from "@/components/templates/TemplateEditor";

export default function NewTemplatePage() {
  return (
    <>
      <Header title="New template" />
      <div className="p-4 lg:p-8">
        <TemplateEditor />
      </div>
    </>
  );
}
