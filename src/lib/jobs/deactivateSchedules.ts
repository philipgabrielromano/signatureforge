import { prisma } from "@/lib/prisma";
import { assignmentMatchesUser } from "@/lib/assignments";
import { writeAudit } from "@/lib/tenant";

export async function deactivateExpiredCampaigns(now = new Date()) {
  const expired = await prisma.schedule.findMany({
    where: {
      status: "active",
      endAt: { not: null, lte: now },
    },
  });

  const deactivated: string[] = [];

  for (const schedule of expired) {
    const users = await prisma.user.findMany({ where: { tenantId: schedule.tenantId } });
    const matching = users.filter((user) =>
      assignmentMatchesUser(
        {
          isActive: true,
          isOrgWide: schedule.isOrgWide,
          targetType: schedule.targetType,
          targetValue: schedule.targetValue,
        } as never,
        user
      )
    );

    if (matching.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: matching.map((u) => u.id) } },
        data: {
          currentSignatureId: schedule.revertTemplateId,
          signaturePushStatus: "pending",
          signaturePushError: null,
        },
      });
    }

    await prisma.schedule.update({
      where: { id: schedule.id },
      data: { status: "completed", revertedAt: now },
    });

    await writeAudit({
      tenantId: schedule.tenantId,
      actorEmail: "cron",
      action: "schedule.completed",
      resourceType: "schedule",
      resourceId: schedule.id,
      details: { userCount: matching.length, revertTemplateId: schedule.revertTemplateId },
    });

    deactivated.push(schedule.id);
  }

  return { count: deactivated.length, ids: deactivated };
}
