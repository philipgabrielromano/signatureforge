import { prisma } from "@/lib/prisma";
import { assignmentMatchesUser } from "@/lib/assignments";
import { loadGroupMemberMap } from "@/lib/graph/groups";
import { tenantGraphConfig, writeAudit } from "@/lib/tenant";

export async function activateScheduledCampaigns(now = new Date()) {
  const due = await prisma.schedule.findMany({
    where: {
      status: "scheduled",
      startAt: { lte: now },
    },
    include: { template: true, tenant: true },
  });

  const activated: string[] = [];

  for (const schedule of due) {
    const users = await prisma.user.findMany({ where: { tenantId: schedule.tenantId } });
    const groupMembers = await loadGroupMemberMap(tenantGraphConfig(schedule.tenant), [schedule]);
    const matching = users.filter((user) =>
      assignmentMatchesUser(
        {
          isActive: true,
          isOrgWide: schedule.isOrgWide,
          targetType: schedule.targetType,
          targetValue: schedule.targetValue,
        },
        user,
        groupMembers
      )
    );

    if (matching.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: matching.map((u) => u.id) } },
        data: {
          currentSignatureId: schedule.templateId,
          signaturePushStatus: "pending",
          signaturePushError: null,
        },
      });
    }

    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { status: "active", deployedAt: now },
    });

    await writeAudit({
      tenantId: schedule.tenantId,
      actorEmail: "cron",
      action: "schedule.activated",
      resourceType: "schedule",
      resourceId: schedule.id,
      details: { userCount: matching.length, templateId: schedule.templateId },
    });

    activated.push(schedule.id);
  }

  return { count: activated.length, ids: activated };
}
