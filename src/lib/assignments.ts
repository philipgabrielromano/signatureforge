import type { Assignment, Template, User } from "@prisma/client";

type AssignmentWithTemplate = Assignment & { template: Template };

export function assignmentMatchesUser(assignment: Assignment, user: User): boolean {
  if (!assignment.isActive) return false;
  if (assignment.isOrgWide) return true;

  if (assignment.targetType === "user") {
    return (
      assignment.targetValue === user.email ||
      assignment.targetValue === user.id ||
      assignment.targetValue === user.azureObjectId
    );
  }

  if (assignment.targetType === "department") {
    return Boolean(
      user.department &&
        assignment.targetValue &&
        user.department.toLowerCase() === assignment.targetValue.toLowerCase()
    );
  }

  if (assignment.targetType === "group") {
    return Boolean(
      user.department &&
        assignment.targetValue &&
        user.department.toLowerCase() === assignment.targetValue.toLowerCase()
    );
  }

  return false;
}

export function resolveTemplateForUser(
  user: User,
  assignments: AssignmentWithTemplate[]
): Template | null {
  const matches = assignments
    .filter((a) => a.template.isActive && assignmentMatchesUser(a, user))
    .sort((a, b) => b.priority - a.priority || b.createdAt.getTime() - a.createdAt.getTime());

  return matches[0]?.template ?? null;
}

export function schedulesOverlap(a: {
  startAt: Date;
  endAt: Date | null;
  isOrgWide: boolean;
  targetType: string | null;
  targetValue: string | null;
}, b: {
  startAt: Date;
  endAt: Date | null;
  isOrgWide: boolean;
  targetType: string | null;
  targetValue: string | null;
}): boolean {
  const aEnd = a.endAt ?? new Date("9999-12-31");
  const bEnd = b.endAt ?? new Date("9999-12-31");
  const timeOverlap = a.startAt <= bEnd && b.startAt <= aEnd;
  if (!timeOverlap) return false;

  if (a.isOrgWide || b.isOrgWide) return true;
  if (a.targetType && b.targetType && a.targetType === b.targetType) {
    return (a.targetValue || "").toLowerCase() === (b.targetValue || "").toLowerCase();
  }
  return false;
}
