import { prisma } from "./prisma";

export async function recordAudit(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  meta?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      description: input.description,
      meta: input.meta ? JSON.stringify(input.meta) : null,
    },
  });
}

export async function notifyUsers(
  userIds: string[],
  payload: { type: string; title: string; body: string; link?: string }
) {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (!unique.length) return;
  const preferences = await prisma.notificationPreference.findMany({
    where: { userId: { in: unique } },
  });
  const prefMap = new Map(preferences.map((p) => [p.userId, p]));
  const allowed = unique.filter((id) => {
    const pref = prefMap.get(id);
    if (!pref) return true;
    if (payload.type === "RENT" && !pref.rentReminders) return false;
    if (payload.type === "ANNOUNCEMENT" && !pref.announcements) return false;
    if (payload.type === "MENU" && !pref.menuUpdates) return false;
    if (payload.type === "COMPLAINT" && !pref.complaintUpdates) return false;
    return true;
  });
  if (!allowed.length) return;
  await prisma.notification.createMany({
    data: allowed.map((userId) => ({
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      link: payload.link ?? null,
    })),
  });
}
