import { prisma } from "@/lib/prisma";
import { getPrimaryTenant } from "@/lib/tenant";
import { Header } from "@/components/layout/Header";
import { UserTable } from "@/components/users/UserTable";
import { UserSyncButton } from "@/components/users/UserSyncButton";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const tenant = await getPrimaryTenant();
  const [users, templates, deptRows] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: tenant.id },
      include: { currentSignature: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.template.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { tenantId: tenant.id, department: { not: null } },
      distinct: ["department"],
      select: { department: true },
    }),
  ]);

  return (
    <>
      <Header title="Users" />
      <div className="space-y-4 p-4 lg:p-8">
        <div className="flex justify-end">
          <UserSyncButton />
        </div>
        <UserTable
          users={users.map((user) => ({
            id: user.id,
            displayName: user.displayName,
            email: user.email,
            department: user.department,
            jobTitle: user.jobTitle,
            signaturePushStatus: user.signaturePushStatus,
            signaturePushError: user.signaturePushError,
            lastSignaturePushedAt: user.lastSignaturePushedAt?.toISOString() ?? null,
            currentSignature: user.currentSignature
              ? { id: user.currentSignature.id, name: user.currentSignature.name }
              : null,
          }))}
          departments={deptRows.map((d) => d.department).filter((d): d is string => Boolean(d))}
          templates={templates}
        />
      </div>
    </>
  );
}
