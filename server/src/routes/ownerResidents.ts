import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ah, AppError, parse } from "../lib/http";
import { authenticate, requireRole } from "../lib/auth";
import { mapResidency, pgForOwner, residencyForOwner } from "../lib/access";
import { notifyUsers, recordAudit } from "../lib/audit";
import { monthKey, shiftMonth } from "../lib/dates";
import { invitationEmail, sendMail, welcomeResidentEmail } from "../lib/mailer";
import { env } from "../lib/env";

const router = Router();

router.use(authenticate);
router.use(requireRole("PG_OWNER"));

const residentInclude = {
  resident: { select: { id: true, name: true, email: true, phone: true } },
  room: { select: { number: true } },
  floor: { select: { name: true } },
  bed: { select: { label: true } },
} as const;

router.get(
  "/residents",
  ah(async (req, res) => {
    const query = parse(
      z.object({
        pgId: z.string().optional(),
        status: z.string().optional(),
        search: z.string().optional(),
      }),
      req.query
    );
    const ownerId = req.user!.id;
    const rows = await prisma.residency.findMany({
      where: {
        pg: { ownerId },
        ...(query.pgId ? { pgId: query.pgId } : {}),
        ...(query.status && query.status !== "ALL" ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { resident: { name: { contains: query.search } } },
                { resident: { email: { contains: query.search } } },
                { room: { number: { contains: query.search } } },
              ],
            }
          : {}),
      },
      include: residentInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    const current = monthKey();
    const rentRows = await prisma.rentRecord.findMany({
      where: { residencyId: { in: rows.map((r) => r.id) }, periodMonth: current },
    });
    const rentByResidency = new Map(rentRows.map((r) => [r.residencyId, r]));

    res.json({
      residents: rows.map((row) => {
        const rent = rentByResidency.get(row.id);
        return {
          ...mapResidency(row as never),
          rentStatus: rent ? rent.status : "NOT_GENERATED",
          rentDue: rent?.amountDue ?? row.monthlyRent,
          rentPaid: rent?.amountPaid ?? 0,
        };
      }),
      currentMonth: current,
    });
  })
);

async function allocate(bedId: string, pgId: string, residentId: string) {
  return prisma.$transaction(async (tx) => {
    const bed = await tx.bed.findFirst({ where: { id: bedId, pgId }, include: { room: true } });
    if (!bed) throw new AppError(404, "That bed does not exist in this PG.");
    if (bed.room.status === "MAINTENANCE") throw new AppError(409, "This room is under maintenance.");
    const fresh = await tx.bed.findUnique({ where: { id: bed.id } });
    if (fresh?.activeResidencyId) throw new AppError(409, "That bed has just been taken. Pick another bed.");
    const active = await tx.residency.findFirst({
      where: { residentId, status: { in: ["ACTIVE", "NOTICE"] } },
    });
    if (active) throw new AppError(409, "This resident already lives in a PG. Vacate them first.");
    return { bed, active };
  });
}

router.post(
  "/residents",
  ah(async (req, res) => {
    const data = parse(
      z.object({
        pgId: z.string().min(1, "Select a PG."),
        bedId: z.string().min(1, "Select a bed."),
        name: z.string().trim().min(2, "Enter the resident's name."),
        email: z.string().trim().toLowerCase().email("Enter a valid email."),
        phone: z.string().trim().max(20).optional(),
        monthlyRent: z.coerce.number().int().min(0),
        securityDeposit: z.coerce.number().int().min(0).default(0),
        joinedAt: z.string().optional(),
        password: z.string().min(8).optional(),
      }),
      req.body
    );

    const pg = await pgForOwner(data.pgId, req.user!.id);
    const { bed } = await allocate(data.bedId, pg.id, "__new__");

    let resident = await prisma.user.findUnique({ where: { email: data.email } });
    let temporaryPassword: string | undefined;
    if (resident) {
      if (resident.role !== "RESIDENT") throw new AppError(409, "That email belongs to an owner or admin account.");
      const active = await prisma.residency.findFirst({
        where: { residentId: resident.id, status: { in: ["ACTIVE", "NOTICE"] } },
      });
      if (active) throw new AppError(409, "This person already has an active residency.");
    } else {
      temporaryPassword = data.password ?? crypto.randomBytes(6).toString("base64url");
      resident = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          role: "RESIDENT",
          status: "ACTIVE",
          passwordHash: await bcrypt.hash(temporaryPassword, 10),
          preferences: { create: {} },
        },
      });
    }

    const residency = await prisma.$transaction(async (tx) => {
      const created = await tx.residency.create({
        data: {
          residentId: resident!.id,
          pgId: pg.id,
          floorId: bed.room.floorId,
          roomId: bed.roomId,
          bedId: bed.id,
          status: "ACTIVE",
          monthlyRent: data.monthlyRent,
          securityDeposit: data.securityDeposit,
          joinedAt: data.joinedAt ? new Date(data.joinedAt) : new Date(),
        },
      });
      await tx.bed.update({ where: { id: bed.id }, data: { activeResidencyId: created.id } });
      return created;
    });

    await prisma.notification.create({
      data: {
        userId: resident.id,
        type: "RESIDENCY",
        title: `Welcome to ${pg.name}`,
        body: `You have been added to room ${bed.room.number}, bed ${bed.label}.`,
        link: "/resident",
      },
    });
    if (temporaryPassword) {
      await sendMail({
        to: resident.email,
        subject: `Welcome to ${pg.name}`,
        html: welcomeResidentEmail({
          name: resident.name,
          pgName: pg.name,
          roomNumber: bed.room.number,
          bedLabel: bed.label,
          password: temporaryPassword,
        }),
        category: "WELCOME",
      });
    }
    await recordAudit({
      actorId: req.user!.id,
      action: "RESIDENT_ADDED",
      entityType: "Residency",
      entityId: residency.id,
      description: `${req.user!.name} added ${resident.name} to ${pg.name} room ${bed.room.number}`,
    });

    res.status(201).json({ residencyId: residency.id, temporaryPassword });
  })
);

router.get(
  "/residents/:id",
  ah(async (req, res) => {
    const residency = await residencyForOwner(req.params.id, req.user!.id);
    const [rent, complaints] = await Promise.all([
      prisma.rentRecord.findMany({
        where: { residencyId: residency.id },
        include: { payments: { orderBy: { paidAt: "desc" } } },
        orderBy: { periodMonth: "desc" },
      }),
      prisma.complaint.findMany({
        where: { residencyId: residency.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);
    const history = await prisma.residency.findMany({
      where: { residentId: residency.residentId, id: { not: residency.id } },
      include: { pg: { select: { name: true } }, room: { select: { number: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      residency: {
        ...mapResidency(residency as never),
        statusLabel: residency.status,
      },
      rent,
      complaints,
      previousStays: history.map((h) => ({
        id: h.id,
        pgName: h.pg.name,
        roomNumber: h.room.number,
        status: h.status,
        joinedAt: h.joinedAt,
        vacatedAt: h.vacatedAt,
      })),
    });
  })
);

router.patch(
  "/residents/:id",
  ah(async (req, res) => {
    const residency = await residencyForOwner(req.params.id, req.user!.id);
    const data = parse(
      z.object({
        monthlyRent: z.coerce.number().int().min(0).optional(),
        securityDeposit: z.coerce.number().int().min(0).optional(),
        status: z.enum(["ACTIVE", "NOTICE"]).optional(),
        name: z.string().trim().min(2).optional(),
        phone: z.string().trim().max(20).optional(),
        joinedAt: z.string().optional(),
      }),
      req.body
    );

    if (data.name || data.phone !== undefined) {
      await prisma.user.update({
        where: { id: residency.residentId },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
        },
      });
    }

    const updated = await prisma.residency.update({
      where: { id: residency.id },
      data: {
        ...(data.monthlyRent !== undefined ? { monthlyRent: data.monthlyRent } : {}),
        ...(data.securityDeposit !== undefined ? { securityDeposit: data.securityDeposit } : {}),
        ...(data.status ? { status: data.status, noticeDate: data.status === "NOTICE" ? new Date() : null } : {}),
        ...(data.joinedAt ? { joinedAt: new Date(data.joinedAt) } : {}),
      },
      include: residentInclude,
    });

    if (data.status === "NOTICE") {
      await notifyUsers([residency.residentId], {
        type: "RESIDENCY",
        title: "Notice period started",
        body: "Your residency is now in the notice period.",
        link: "/resident/profile",
      });
    }

    res.json({ residency: mapResidency(updated as never) });
  })
);

router.post(
  "/residents/:id/transfer",
  ah(async (req, res) => {
    const residency = await residencyForOwner(req.params.id, req.user!.id);
    const data = parse(
      z.object({ bedId: z.string().min(1, "Select the new bed."), monthlyRent: z.coerce.number().int().min(0).optional() }),
      req.body
    );
    if (residency.status === "VACATED") throw new AppError(409, "This resident has already vacated.");

    const result = await prisma.$transaction(async (tx) => {
      const bed = await tx.bed.findFirst({
        where: { id: data.bedId, pgId: residency.pgId },
        include: { room: true },
      });
      if (!bed) throw new AppError(404, "That bed is not part of this PG.");
      if (bed.activeResidencyId) throw new AppError(409, "That bed is already occupied.");
      if (bed.id === residency.bedId) throw new AppError(409, "The resident is already on this bed.");

      if (residency.bedId) {
        await tx.bed.updateMany({
          where: { id: residency.bedId, activeResidencyId: residency.id },
          data: { activeResidencyId: null },
        });
      }
      const updated = await tx.residency.update({
        where: { id: residency.id },
        data: {
          floorId: bed.room.floorId,
          roomId: bed.roomId,
          bedId: bed.id,
          ...(data.monthlyRent !== undefined ? { monthlyRent: data.monthlyRent } : {}),
        },
      });
      await tx.bed.update({ where: { id: bed.id }, data: { activeResidencyId: residency.id } });
      return { updated, bed };
    });

    await notifyUsers([residency.residentId], {
      type: "RESIDENCY",
      title: "Room changed",
      body: `You have moved to room ${result.bed.room.number}, bed ${result.bed.label}.`,
      link: "/resident/pg",
    });
    await recordAudit({
      actorId: req.user!.id,
      action: "RESIDENT_TRANSFERRED",
      entityType: "Residency",
      entityId: residency.id,
      description: `${req.user!.name} moved ${residency.resident.name} to room ${result.bed.room.number}`,
    });

    res.json({ residency: mapResidency(result.updated as never) });
  })
);

router.post(
  "/residents/:id/vacate",
  ah(async (req, res) => {
    const residency = await residencyForOwner(req.params.id, req.user!.id);
    const data = parse(
      z.object({
        vacatedAt: z.string().optional(),
        reason: z.string().trim().max(400).optional(),
      }),
      req.body
    );
    if (residency.status === "VACATED") throw new AppError(409, "This resident has already vacated.");

    await prisma.$transaction(async (tx) => {
      if (residency.bedId) {
        await tx.bed.updateMany({
          where: { id: residency.bedId, activeResidencyId: residency.id },
          data: { activeResidencyId: null },
        });
      }
      await tx.residency.update({
        where: { id: residency.id },
        data: {
          status: "VACATED",
          vacatedAt: data.vacatedAt ? new Date(data.vacatedAt) : new Date(),
          exitReason: data.reason || null,
        },
      });
    });

    await prisma.complaint.updateMany({
      where: { residencyId: residency.id, status: { in: ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"] } },
      data: { status: "CLOSED" },
    });
    await notifyUsers([residency.residentId], {
      type: "RESIDENCY",
      title: `You have vacated ${residency.pg.name}`,
      body: "Your rent and complaint history stays available in your account.",
      link: "/resident/history",
    });
    await recordAudit({
      actorId: req.user!.id,
      action: "RESIDENT_VACATED",
      entityType: "Residency",
      entityId: residency.id,
      description: `${req.user!.name} marked ${residency.resident.name} as vacated`,
    });

    res.json({ message: "Resident vacated. The bed is now available." });
  })
);

router.get(
  "/invitations",
  ah(async (req, res) => {
    const invitations = await prisma.pgInvitation.findMany({
      where: { pg: { ownerId: req.user!.id } },
      include: { pg: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const bedIds = invitations.map((i) => i.bedId);
    const beds = await prisma.bed.findMany({
      where: { id: { in: bedIds } },
      include: { room: { include: { floor: true } } },
    });
    const bedMap = new Map(beds.map((b) => [b.id, b]));
    res.json({
      invitations: invitations.map((inv) => {
        const bed = bedMap.get(inv.bedId);
        return {
          ...inv,
          pgName: inv.pg.name,
          roomNumber: bed?.room.number ?? null,
          floorName: bed?.room.floor.name ?? null,
          bedLabel: bed?.label ?? null,
          inviteLink: `/join/${inv.code}`,
        };
      }),
    });
  })
);

router.post(
  "/invitations",
  ah(async (req, res) => {
    const data = parse(
      z.object({
        pgId: z.string().min(1, "Select a PG."),
        bedId: z.string().min(1, "Select a bed."),
        email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
        phone: z.string().trim().max(20).optional(),
        monthlyRent: z.coerce.number().int().min(0).optional(),
      }),
      req.body
    );
    const pg = await pgForOwner(data.pgId, req.user!.id);
    const bed = await prisma.bed.findFirst({
      where: { id: data.bedId, pgId: pg.id },
      include: { room: true },
    });
    if (!bed) throw new AppError(404, "That bed does not exist in this PG.");
    if (bed.activeResidencyId) throw new AppError(409, "That bed is already occupied.");
    const existingInvite = await prisma.pgInvitation.findFirst({
      where: { bedId: bed.id, status: "PENDING" },
    });
    if (existingInvite) throw new AppError(409, "This bed already has a pending invitation.");

    const resident = data.email
      ? await prisma.user.findFirst({ where: { email: data.email, role: "RESIDENT" } })
      : null;

    const invitation = await prisma.pgInvitation.create({
      data: {
        pgId: pg.id,
        floorId: bed.room.floorId,
        roomId: bed.roomId,
        bedId: bed.id,
        invitedById: req.user!.id,
        code: crypto.randomBytes(5).toString("hex").toUpperCase(),
        email: data.email || null,
        phone: data.phone || null,
        residentId: resident?.id ?? null,
        monthlyRent: data.monthlyRent ?? bed.room.rentPerBed,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      },
    });

    if (data.email) {
      await sendMail({
        to: data.email,
        subject: `${pg.name} invited you to a room`,
        html: invitationEmail({
          recipientName: resident?.name ?? data.email.split("@")[0],
          ownerName: req.user!.name,
          pgName: pg.name,
          roomNumber: bed.room.number,
          bedLabel: bed.label,
          rent: `₹${(data.monthlyRent ?? bed.room.rentPerBed).toLocaleString("en-IN")}`,
          code: invitation.code,
        }),
        category: "INVITATION",
      });
    }
    if (resident) {
      await notifyUsers([resident.id], {
        type: "INVITATION",
        title: `Invitation to ${pg.name}`,
        body: `Room ${bed.room.number}, bed ${bed.label}. Use code ${invitation.code} to accept.`,
        link: `/join/${invitation.code}`,
      });
    }
    await recordAudit({
      actorId: req.user!.id,
      action: "INVITATION_SENT",
      entityType: "PgInvitation",
      entityId: invitation.id,
      description: `${req.user!.name} invited a resident to ${pg.name} room ${bed.room.number}`,
    });

    res.status(201).json({
      invitation: {
        ...invitation,
        pgName: pg.name,
        roomNumber: bed.room.number,
        bedLabel: bed.label,
        inviteLink: `/join/${invitation.code}`,
      },
    });
  })
);

router.delete(
  "/invitations/:id",
  ah(async (req, res) => {
    const invitation = await prisma.pgInvitation.findFirst({
      where: { id: req.params.id, pg: { ownerId: req.user!.id } },
    });
    if (!invitation) throw new AppError(404, "Invitation not found.");
    await prisma.pgInvitation.update({ where: { id: invitation.id }, data: { status: "CANCELLED" } });
    res.json({ message: "Invitation cancelled." });
  })
);

const csvCell = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csvDate = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "");

router.get(
  "/residents-export",
  ah(async (req, res) => {
    const query = parse(
      z.object({ pgId: z.string().optional(), status: z.string().optional() }),
      req.query
    );
    const rows = await prisma.residency.findMany({
      where: {
        pg: { ownerId: req.user!.id },
        ...(query.pgId ? { pgId: query.pgId } : {}),
        ...(query.status && query.status !== "ALL" ? { status: query.status } : {}),
      },
      include: { ...residentInclude, pg: { select: { name: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    const table = [
      [
        "Resident",
        "Email",
        "Phone",
        "PG",
        "Floor",
        "Room",
        "Bed",
        "Status",
        "Monthly rent",
        "Security deposit",
        "Joined",
        "Vacated",
        "Notice date",
        "Exit reason",
      ],
      ...rows.map((row) => [
        row.resident.name,
        row.resident.email,
        row.resident.phone ?? "",
        row.pg.name,
        row.floor.name,
        row.room.number,
        row.bed?.label ?? "",
        row.status,
        row.monthlyRent,
        row.securityDeposit,
        csvDate(row.joinedAt),
        csvDate(row.vacatedAt),
        csvDate(row.noticeDate),
        row.exitReason ?? "",
      ]),
    ];

    await recordAudit({
      actorId: req.user!.id,
      action: "RESIDENTS_EXPORTED",
      entityType: "Residency",
      entityId: req.user!.id,
      description: `${req.user!.name} exported ${rows.length} resident records`,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="residents-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send("\uFEFF" + table.map((line) => line.map(csvCell).join(",")).join("\r\n"));
  })
);

export default router;
