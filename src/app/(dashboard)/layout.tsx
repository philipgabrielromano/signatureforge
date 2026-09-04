import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
