import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ah, AppError, parse } from "../lib/http";
import { authenticate } from "../lib/auth";

const router = Router();

router.get(
  "/notifications",
  authenticate,
  ah(async (req, res) => {
    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: "desc" },
        take: 60,
      }),
      prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
    ]);
    res.json({ notifications, unread });
  })
);

router.post(
  "/notifications/:id/read",
  authenticate,
  ah(async (req, res) => {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!notification) throw new AppError(404, "Notification not found.");
    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: notification.readAt ?? new Date() },
    });
    res.json({ notification: updated });
  })
);

router.post(
  "/notifications/read-all",
  authenticate,
  ah(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ message: "All notifications marked as read." });
  })
);

router.delete(
  "/notifications/:id",
  authenticate,
  ah(async (req, res) => {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!notification) throw new AppError(404, "Notification not found.");
    await prisma.notification.delete({ where: { id: notification.id } });
    res.json({ message: "Notification removed." });
  })
);

export default router;
