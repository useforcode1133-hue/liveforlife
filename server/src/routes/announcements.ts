import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ah, AppError, parse } from "../lib/http";
import { authenticate, requireRole } from "../lib/auth";
import { notifyUsers, recordAudit } from "../lib/audit";
import { activeResidencyForUser, pgForOwner } from "../lib/access";

const router = Router();

router.use(authenticate);

const ANNOUNCEMENT_CATEGORIES = [
  "GENERAL",
  "RENT",
  "MAINTENANCE",
  "FOOD",
  "WATER",
  "ELECTRICITY",
  "SECURITY",
  "EMERGENCY",
] as const;

router.get(
  "/owner/announcements",
  requireRole("PG_OWNER"),
  ah(async (req, res) => {
    const query = parse(z.object({ pgId: z.string().optional() }), req.query);
    const rows = await prisma.announcement.findMany({
      where: { pg: { ownerId: req.user!.id }, ...(query.pgId ? { pgId: query.pgId } : {}) },
      include: { pg: { select: { name: true } }, targets: true, author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
    });
    const pgs = await prisma.pg.findMany({ where: { ownerId: req.user!.id }, select: { id: true, name: true } });
    res.json({
      announcements: rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        category: row.category,
        audience: row.audience,
        floorId: row.floorId,
        pgId: row.pgId,
        pgName: row.pg.name,
        recipientCount: row.audience === "SELECTED" ? row.targets.length : null,
        authorName: row.author.name,
        createdAt: row.createdAt,
      })),
      pgs,
    });
  })
);

router.post(
  "/owner/announcements",
  requireRole("PG_OWNER"),
  ah(async (req, res) => {
    const data = parse(
      z.object({
        pgId: z.string().min(1, "Select a PG."),
        title: z.string().trim().min(4, "Add a short title."),
        body: z.string().trim().min(5, "Write your announcement."),
        category: z.enum(ANNOUNCEMENT_CATEGORIES).default("GENERAL"),
        audience: z.enum(["ALL", "FLOOR", "SELECTED"]).default("ALL"),
        floorId: z.string().optional(),
        residentIds: z.array(z.string()).default([]),
      }),
      req.body
    );
    const pg = await pgForOwner(data.pgId, req.user!.id);
    if (data.audience === "FLOOR" && !data.floorId) throw new AppError(422, "Choose the floor to notify.");
    const selectedResidents = data.residentIds ?? [];
    if (data.audience === "SELECTED" && selectedResidents.length === 0) {
      throw new AppError(422, "Select at least one resident.");
    }

    const announcement = await prisma.announcement.create({
      data: {
        pgId: pg.id,
        authorId: req.user!.id,
        title: data.title,
        body: data.body,
        category: data.category,
        audience: data.audience,
        floorId: data.audience === "FLOOR" ? data.floorId : null,
        targets:
          data.audience === "SELECTED"
            ? { create: selectedResidents.map((userId) => ({ userId })) }
            : undefined,
      },
    });

    let recipientIds: string[] = [];
    if (data.audience === "ALL") {
      const rows = await prisma.residency.findMany({
        where: { pgId: pg.id, status: { in: ["ACTIVE", "NOTICE"] } },
        select: { residentId: true },
      });
      recipientIds = rows.map((r) => r.residentId);
    } else if (data.audience === "FLOOR") {
      const rows = await prisma.residency.findMany({
        where: { pgId: pg.id, floorId: data.floorId, status: { in: ["ACTIVE", "NOTICE"] } },
        select: { residentId: true },
      });
      recipientIds = rows.map((r) => r.residentId);
    } else {
      recipientIds = selectedResidents;
    }

    await notifyUsers(recipientIds, {
      type: "ANNOUNCEMENT",
      title: data.title,
      body: data.body.length > 140 ? `${data.body.slice(0, 140)}…` : data.body,
      link: "/resident/announcements",
    });
    await recordAudit({
      actorId: req.user!.id,
      action: "ANNOUNCEMENT_CREATED",
      entityType: "Announcement",
      entityId: announcement.id,
      description: `${req.user!.name} announced "${data.title}" to ${recipientIds.length} residents`,
    });

    res.status(201).json({ id: announcement.id, recipientCount: recipientIds.length });
  })
);

router.delete(
  "/owner/announcements/:id",
  requireRole("PG_OWNER"),
  ah(async (req, res) => {
    const row = await prisma.announcement.findFirst({
      where: { id: req.params.id, pg: { ownerId: req.user!.id } },
    });
    if (!row) throw new AppError(404, "Announcement not found.");
    await prisma.announcement.delete({ where: { id: row.id } });
    res.json({ message: "Announcement removed." });
  })
);

router.get(
  "/resident/announcements",
  requireRole("RESIDENT"),
  ah(async (req, res) => {
    const residency = await activeResidencyForUser(req.user!.id);
    if (!residency) return res.json({ announcements: [] });
    const rows = await prisma.announcement.findMany({
      where: {
        pgId: residency.pgId,
        OR: [
          { audience: "ALL" },
          { audience: "FLOOR", floorId: residency.floorId },
          { audience: "SELECTED", targets: { some: { userId: req.user!.id } } },
        ],
      },
      include: { author: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    res.json({
      announcements: rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        category: row.category,
        authorName: row.author.name,
        createdAt: row.createdAt,
      })),
    });
  })
);

export default router;
