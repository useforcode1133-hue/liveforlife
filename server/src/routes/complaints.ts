import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ah, AppError, parse } from "../lib/http";
import { authenticate, requireRole } from "../lib/auth";
import { notifyUsers, recordAudit } from "../lib/audit";
import { jsonList, toJsonList } from "../lib/serialize";
import { activeResidencyForUser } from "../lib/access";
import { complaintUpdateEmail, sendMail } from "../lib/mailer";

const router = Router();

export const COMPLAINT_CATEGORIES = [
  "WIFI",
  "WATER",
  "ELECTRICITY",
  "ROOM",
  "BATHROOM",
  "CLEANING",
  "FOOD",
  "SECURITY",
  "OTHER",
] as const;

export const COMPLAINT_STATUSES = ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

const ACTIVE_STATUSES = ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"];

function serializeComplaint(row: {
  id: string;
  category: string;
  title: string;
  description: string;
  images: string;
  urgency: string;
  priority: string;
  status: string;
  response: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  resident?: { id: string; name: string; email: string; phone: string | null };
  pg?: { id?: string; name: string };
  roomNumber?: string | null;
  updates?: { id: string; message: string; statusTo: string | null; createdAt: Date; author: { name: string } }[];
}) {
  return {
    ...row,
    images: jsonList(row.images),
    updates: row.updates?.map((u) => ({ ...u })),
  };
}

router.post(
  "/resident/complaints",
  authenticate,
  requireRole("RESIDENT"),
  ah(async (req, res) => {
    const data = parse(
      z.object({
        category: z.enum(COMPLAINT_CATEGORIES),
        title: z.string().trim().min(4, "Give your issue a short title."),
        description: z.string().trim().min(10, "Describe the issue in a little more detail."),
        images: z.array(z.string()).max(4).default([]),
        urgency: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
      }),
      req.body
    );
    const residency = await activeResidencyForUser(req.user!.id);
    if (!residency) throw new AppError(409, "Join a PG before reporting an issue.");

    const complaint = await prisma.complaint.create({
      data: {
        pgId: residency.pgId,
        residentId: req.user!.id,
        residencyId: residency.id,
        category: data.category,
        title: data.title,
        description: data.description,
        images: toJsonList(data.images),
        urgency: data.urgency,
        status: "SUBMITTED",
        updates: {
          create: {
            authorId: req.user!.id,
            message: "Complaint submitted.",
            statusTo: "SUBMITTED",
          },
        },
      },
    });

    const owners = await prisma.pg.findUnique({ where: { id: residency.pgId }, select: { ownerId: true } });
    if (owners) {
      await notifyUsers([owners.ownerId], {
        type: "COMPLAINT",
        title: "New complaint received",
        body: `${req.user!.name}: ${data.title}`,
        link: `/owner/complaints`,
      });
    }
    await recordAudit({
      actorId: req.user!.id,
      action: "COMPLAINT_CREATED",
      entityType: "Complaint",
      entityId: complaint.id,
      description: `${req.user!.name} reported "${data.title}"`,
    });

    res.status(201).json({ complaint: serializeComplaint(complaint) });
  })
);

router.get(
  "/resident/complaints",
  authenticate,
  requireRole("RESIDENT"),
  ah(async (req, res) => {
    const rows = await prisma.complaint.findMany({
      where: { residentId: req.user!.id },
      include: {
        pg: { select: { name: true } },
        updates: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ complaints: rows.map((row) => serializeComplaint(row)) });
  })
);

router.post(
  "/resident/complaints/:id/reopen",
  authenticate,
  requireRole("RESIDENT"),
  ah(async (req, res) => {
    const complaint = await prisma.complaint.findFirst({
      where: { id: req.params.id, residentId: req.user!.id },
    });
    if (!complaint) throw new AppError(404, "Complaint not found.");
    if (!["RESOLVED", "CLOSED"].includes(complaint.status)) {
      throw new AppError(409, "This complaint is still open.");
    }
    const data = parse(z.object({ message: z.string().trim().min(5, "Tell us what is still wrong.") }), req.body);
    const updated = await prisma.complaint.update({
      where: { id: complaint.id },
      data: {
        status: "SUBMITTED",
        resolvedAt: null,
        updates: { create: { authorId: req.user!.id, message: data.message, statusFrom: complaint.status, statusTo: "SUBMITTED" } },
      },
    });
    const pg = await prisma.pg.findUnique({ where: { id: complaint.pgId }, select: { ownerId: true } });
    if (pg) {
      await notifyUsers([pg.ownerId], {
        type: "COMPLAINT",
        title: "Complaint reopened",
        body: `${req.user!.name}: ${data.message}`,
        link: "/owner/complaints",
      });
    }
    res.json({ complaint: serializeComplaint(updated) });
  })
);

router.get(
  "/owner/complaints",
  authenticate,
  requireRole("PG_OWNER"),
  ah(async (req, res) => {
    const query = parse(
      z.object({
        status: z.string().optional(),
        pgId: z.string().optional(),
        category: z.string().optional(),
        urgency: z.string().optional(),
        search: z.string().optional(),
      }),
      req.query
    );
    const rows = await prisma.complaint.findMany({
      where: {
        pg: { ownerId: req.user!.id },
        ...(query.pgId ? { pgId: query.pgId } : {}),
        ...(query.status && query.status !== "ALL" ? { status: query.status } : {}),
        ...(query.category && query.category !== "ALL" ? { category: query.category } : {}),
        ...(query.urgency && query.urgency !== "ALL" ? { urgency: query.urgency } : {}),
        ...(query.search ? { title: { contains: query.search } } : {}),
      },
      include: {
        resident: { select: { id: true, name: true, email: true, phone: true } },
        pg: { select: { id: true, name: true } },
        residency: { include: { room: { select: { number: true } } } },
        updates: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    res.json({
      complaints: rows.map((row) =>
        serializeComplaint({
          ...row,
          roomNumber: row.residency?.room.number ?? null,
        })
      ),
      counts: {
        total: rows.length,
        open: rows.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
        resolved: rows.filter((r) => r.status === "RESOLVED").length,
        closed: rows.filter((r) => r.status === "CLOSED").length,
      },
    });
  })
);

router.get(
  "/owner/complaints/:id",
  authenticate,
  requireRole("PG_OWNER"),
  ah(async (req, res) => {
    const row = await prisma.complaint.findFirst({
      where: { id: req.params.id, pg: { ownerId: req.user!.id } },
      include: {
        resident: { select: { id: true, name: true, email: true, phone: true } },
        pg: { select: { id: true, name: true } },
        residency: { include: { room: { select: { number: true } }, floor: { select: { name: true } } } },
        updates: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!row) throw new AppError(404, "Complaint not found.");
    res.json({ complaint: serializeComplaint({ ...row, roomNumber: row.residency?.room.number ?? null }) });
  })
);

router.patch(
  "/owner/complaints/:id",
  authenticate,
  requireRole("PG_OWNER"),
  ah(async (req, res) => {
    const complaint = await prisma.complaint.findFirst({
      where: { id: req.params.id, pg: { ownerId: req.user!.id } },
    });
    if (!complaint) throw new AppError(404, "Complaint not found.");
    const data = parse(
      z.object({
        status: z.enum(COMPLAINT_STATUSES).optional(),
        priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
        response: z.string().trim().max(1500).optional(),
      }),
      req.body
    );
    if (!data.status && !data.priority && data.response === undefined) {
      throw new AppError(422, "Nothing to update.");
    }

    const statusChanged = data.status && data.status !== complaint.status;
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.complaint.update({
        where: { id: complaint.id },
        data: {
          ...(data.status ? { status: data.status } : {}),
          ...(data.priority ? { priority: data.priority } : {}),
          ...(data.response !== undefined ? { response: data.response || null } : {}),
          ...(data.status === "RESOLVED" ? { resolvedAt: new Date() } : {}),
        },
      });
      if (statusChanged || data.response) {
        await tx.complaintUpdate.create({
          data: {
            complaintId: complaint.id,
            authorId: req.user!.id,
            message: data.response || `Status changed to ${String(data.status).replace("_", " ").toLowerCase()}.`,
            statusFrom: complaint.status,
            statusTo: data.status ?? complaint.status,
          },
        });
      }
      return row;
    });

    if (statusChanged) {
      await notifyUsers([complaint.residentId], {
        type: "COMPLAINT",
        title: `Complaint update: ${String(data.status).replace("_", " ")}`,
        body: data.response || `Your complaint "${complaint.title}" is now ${String(data.status).replace("_", " ").toLowerCase()}.`,
        link: "/resident/complaints",
      });
    } else if (data.response) {
      await notifyUsers([complaint.residentId], {
        type: "COMPLAINT",
        title: "Owner replied to your complaint",
        body: data.response,
        link: "/resident/complaints",
      });
    }
    const resident = await prisma.user.findUnique({ where: { id: complaint.residentId }, select: { email: true, name: true } });
    if (resident && (statusChanged || data.response)) {
      await sendMail({
        to: resident.email,
        subject: `Update on your complaint: ${complaint.title}`,
        html: complaintUpdateEmail({
          name: resident.name,
          title: complaint.title,
          status: String(data.status ?? complaint.status).replace("_", " ").toLowerCase(),
          message: data.response || undefined,
        }),
        category: "COMPLAINT",
      });
    }
    await recordAudit({
      actorId: req.user!.id,
      action: "COMPLAINT_UPDATED",
      entityType: "Complaint",
      entityId: complaint.id,
      description: `${req.user!.name} updated complaint "${complaint.title}"`,
      meta: { status: data.status, priority: data.priority },
    });

    res.json({ complaint: serializeComplaint(updated) });
  })
);

export default router;
