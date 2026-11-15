import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ah, AppError, parse } from "../lib/http";
import { authenticate, requireRole } from "../lib/auth";
import { notifyUsers, recordAudit } from "../lib/audit";
import { activeResidencyForUser } from "../lib/access";
import { monthKey, monthLabel, todayKey } from "../lib/dates";
import { jsonList } from "../lib/serialize";

const router = Router();

const effectiveStatus = (record: { amountPaid: number; amountDue: number; dueDate: Date; status: string }) => {
  if (record.amountPaid >= record.amountDue) return "PAID";
  if (record.amountPaid > 0) return "PARTIAL";
  if (record.dueDate < new Date()) return "OVERDUE";
  return record.status === "PARTIAL" ? "PARTIAL" : "UNPAID";
};

/** Public preview of an invitation so someone can see the PG before signing in. */
router.get(
  "/public-invitation/:code",
  ah(async (req, res) => {
    const invitation = await prisma.pgInvitation.findUnique({
      where: { code: req.params.code.toUpperCase() },
      include: {
        pg: { select: { name: true, type: true, city: true, state: true, images: true } },
        invitedBy: { select: { name: true } },
      },
    });
    if (!invitation) throw new AppError(404, "This invitation link is not valid.");
    const bed = await prisma.bed.findUnique({
      where: { id: invitation.bedId },
      include: { room: { include: { floor: true } } },
    });
    res.json({
      invitation: {
        code: invitation.code,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        email: invitation.email,
        monthlyRent: invitation.monthlyRent,
        pg: {
          name: invitation.pg.name,
          type: invitation.pg.type,
          city: invitation.pg.city,
          state: invitation.pg.state,
          image: jsonList(invitation.pg.images)[0] ?? null,
        },
        ownerName: invitation.invitedBy.name,
        roomNumber: bed?.room.number ?? null,
        floorName: bed?.room.floor.name ?? null,
        bedLabel: bed?.label ?? null,
      },
    });
  })
);

router.use(authenticate, requireRole("RESIDENT"));

router.get(
  "/dashboard",
  ah(async (req, res) => {
    const residency = await activeResidencyForUser(req.user!.id);
    if (!residency) {
      const invitations = await prisma.pgInvitation.findMany({
        where: {
          status: "PENDING",
          OR: [{ residentId: req.user!.id }, { email: req.user!.email }],
        },
        include: { pg: { select: { name: true } } },
        take: 5,
      });
      return res.json({ residency: null, invitations: invitations.map((i) => ({ id: i.id, code: i.code, pgName: i.pg.name })) });
    }

    const current = monthKey();
    const [rentRecord, todayMenu, announcements, complaints, unread, roommates] = await Promise.all([
      prisma.rentRecord.findUnique({
        where: { residencyId_periodMonth: { residencyId: residency.id, periodMonth: current } },
        include: { payments: true },
      }),
      prisma.foodMenu.findUnique({
        where: { pgId_date: { pgId: residency.pgId, date: todayKey() } },
        include: { items: true },
      }),
      prisma.announcement.findMany({
        where: {
          pgId: residency.pgId,
          OR: [
            { audience: "ALL" },
            { audience: "FLOOR", floorId: residency.floorId },
            { audience: "SELECTED", targets: { some: { userId: req.user!.id } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      prisma.complaint.findMany({
        where: { residentId: req.user!.id, status: { in: ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS"] } },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
      prisma.residency.findMany({
        where: { roomId: residency.roomId, status: { in: ["ACTIVE", "NOTICE"] }, residentId: { not: req.user!.id } },
        include: { resident: { select: { id: true, name: true } }, bed: true },
      }),
    ]);

    const meals: Record<string, string[]> = { BREAKFAST: [], LUNCH: [], SNACKS: [], DINNER: [] };
    for (const item of todayMenu?.items ?? []) {
      meals[item.meal] = [...(meals[item.meal] ?? []), item.name];
    }

    res.json({
      residency: {
        id: residency.id,
        status: residency.status,
        monthlyRent: residency.monthlyRent,
        securityDeposit: residency.securityDeposit,
        joinedAt: residency.joinedAt,
        roomNumber: residency.room.number,
        floorName: residency.floor.name,
        bedLabel: residency.bed?.label ?? null,
        pg: {
          id: residency.pg.id,
          name: residency.pg.name,
          type: residency.pg.type,
          city: residency.pg.city,
          image: jsonList(residency.pg.images)[0] ?? null,
          wifiName: residency.pg.wifiName,
          wifiPassword: residency.pg.wifiPassword,
        },
      },
      rent: rentRecord
        ? {
            id: rentRecord.id,
            periodMonth: rentRecord.periodMonth,
            amountDue: rentRecord.amountDue,
            amountPaid: rentRecord.amountPaid,
            balance: Math.max(rentRecord.amountDue - rentRecord.amountPaid, 0),
            dueDate: rentRecord.dueDate,
            status: effectiveStatus(rentRecord),
          }
        : null,
      todayMenu: todayMenu ? { date: todayMenu.date, note: todayMenu.note, meals } : null,
      announcements: announcements.map((a) => ({ id: a.id, title: a.title, body: a.body, category: a.category, createdAt: a.createdAt })),
      openComplaints: complaints.map((c) => ({ id: c.id, title: c.title, status: c.status, category: c.category })),
      unreadNotifications: unread,
      roommates: roommates.map((r) => ({ name: r.resident.name, bedLabel: r.bed?.label ?? null })),
      currentMonth: current,
      currentMonthLabel: monthLabel(current),
    });
  })
);

router.get(
  "/pg",
  ah(async (req, res) => {
    const residency = await activeResidencyForUser(req.user!.id);
    if (!residency) throw new AppError(409, "You are not part of a PG right now.");
    const [roommates, owner] = await Promise.all([
      prisma.residency.findMany({
        where: { roomId: residency.roomId, status: { in: ["ACTIVE", "NOTICE"] } },
        include: { resident: { select: { id: true, name: true } }, bed: true },
      }),
      prisma.user.findUnique({ where: { id: residency.pg.ownerId }, select: { name: true, email: true, phone: true } }),
    ]);
    const pg = residency.pg;

    res.json({
      pg: {
        id: pg.id,
        name: pg.name,
        type: pg.type,
        description: pg.description,
        address: pg.address,
        city: pg.city,
        state: pg.state,
        pincode: pg.pincode,
        images: jsonList(pg.images),
        facilities: jsonList(pg.facilities),
        houseRules: pg.houseRules,
        checkInRules: pg.checkInRules,
        checkOutRules: pg.checkOutRules,
        emergencyName: pg.emergencyName,
        emergencyPhone: pg.emergencyPhone,
        wifiName: pg.wifiName,
        wifiPassword: pg.wifiPassword,
        wifiInstructions: pg.wifiInstructions,
        waterTimings: pg.waterTimings,
        laundryTimings: pg.laundryTimings,
        cleaningSchedule: pg.cleaningSchedule,
        electricityInfo: pg.electricityInfo,
        visitorRules: pg.visitorRules,
        commonAreaRules: pg.commonAreaRules,
        notice: pg.notice,
        rentMin: pg.rentMin,
        rentMax: pg.rentMax,
      },
      residency: {
        id: residency.id,
        status: residency.status,
        floorName: residency.floor.name,
        roomNumber: residency.room.number,
        bedLabel: residency.bed?.label ?? null,
        monthlyRent: residency.monthlyRent,
        securityDeposit: residency.securityDeposit,
        joinedAt: residency.joinedAt,
        roomType: residency.room.roomType,
        amenities: jsonList(residency.room.amenities),
      },
      roommates: roommates.map((r) => ({
        id: r.resident.id,
        name: r.resident.name,
        bedLabel: r.bed?.label ?? null,
        isMe: r.resident.id === req.user!.id,
      })),
      owner,
    });
  })
);

router.get(
  "/rent",
  ah(async (req, res) => {
    const residencies = await prisma.residency.findMany({
      where: { residentId: req.user!.id },
      include: { pg: { select: { name: true } }, room: { select: { number: true } } },
      orderBy: { createdAt: "desc" },
    });
    const records = await prisma.rentRecord.findMany({
      where: { residencyId: { in: residencies.map((r) => r.id) } },
      include: { payments: { orderBy: { paidAt: "desc" } } },
      orderBy: [{ periodMonth: "desc" }],
    });
    const residencyMap = new Map(residencies.map((r) => [r.id, r]));

    res.json({
      records: records.map((record) => {
        const residency = residencyMap.get(record.residencyId);
        return {
          id: record.id,
          periodMonth: record.periodMonth,
          periodLabel: monthLabel(record.periodMonth),
          amountDue: record.amountDue,
          amountPaid: record.amountPaid,
          balance: Math.max(record.amountDue - record.amountPaid, 0),
          dueDate: record.dueDate,
          paidAt: record.paidAt,
          status: effectiveStatus(record),
          notes: record.notes,
          pgName: residency?.pg.name ?? "",
          roomNumber: residency?.room.number ?? "",
          isCurrent: residency?.status === "ACTIVE" || residency?.status === "NOTICE",
          payments: record.payments,
        };
      }),
      canSubmitProof: Boolean(residencies.find((r) => ["ACTIVE", "NOTICE"].includes(r.status))),
    });
  })
);

router.get(
  "/history",
  ah(async (req, res) => {
    const rows = await prisma.residency.findMany({
      where: { residentId: req.user!.id },
      include: {
        pg: { select: { id: true, name: true, city: true } },
        room: { select: { number: true } },
        floor: { select: { name: true } },
        bed: { select: { label: true } },
        rentRecords: { select: { amountDue: true, amountPaid: true, periodMonth: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      stays: rows.map((row) => ({
        id: row.id,
        status: row.status,
        pgName: row.pg.name,
        city: row.pg.city,
        roomNumber: row.room.number,
        floorName: row.floor.name,
        bedLabel: row.bed?.label ?? null,
        monthlyRent: row.monthlyRent,
        joinedAt: row.joinedAt,
        vacatedAt: row.vacatedAt,
        exitReason: row.exitReason,
        totalBilled: row.rentRecords.reduce((s, r) => s + r.amountDue, 0),
        totalPaid: row.rentRecords.reduce((s, r) => s + r.amountPaid, 0),
      })),
    });
  })
);

router.get(
  "/invitations",
  ah(async (req, res) => {
    const invitations = await prisma.pgInvitation.findMany({
      where: {
        status: "PENDING",
        OR: [{ residentId: req.user!.id }, { email: req.user!.email }],
      },
      include: { pg: { select: { name: true, city: true, type: true } }, invitedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const beds = await prisma.bed.findMany({
      where: { id: { in: invitations.map((i) => i.bedId) } },
      include: { room: { include: { floor: true } } },
    });
    const bedMap = new Map(beds.map((b) => [b.id, b]));
    res.json({
      invitations: invitations.map((inv) => {
        const bed = bedMap.get(inv.bedId);
        return {
          id: inv.id,
          code: inv.code,
          pgName: inv.pg.name,
          city: inv.pg.city,
          type: inv.pg.type,
          ownerName: inv.invitedBy.name,
          roomNumber: bed?.room.number ?? null,
          floorName: bed?.room.floor.name ?? null,
          bedLabel: bed?.label ?? null,
          monthlyRent: inv.monthlyRent,
          expiresAt: inv.expiresAt,
        };
      }),
    });
  })
);

router.post(
  "/invitations/accept",
  ah(async (req, res) => {
    const data = parse(z.object({ code: z.string().trim().min(3, "Enter the invitation code.") }), req.body);
    const invitation = await prisma.pgInvitation.findUnique({
      where: { code: data.code.toUpperCase() },
      include: { pg: true },
    });
    if (!invitation) throw new AppError(404, "That invitation code is not valid.");
    if (invitation.status !== "PENDING") throw new AppError(409, "This invitation is no longer active.");
    if (invitation.expiresAt < new Date()) throw new AppError(409, "This invitation has expired. Ask the owner for a new one.");
    if (invitation.email && invitation.email !== req.user!.email) {
      throw new AppError(403, `This invitation was sent to ${invitation.email}. Sign in with that email.`);
    }

    const existing = await prisma.residency.findFirst({
      where: { residentId: req.user!.id, status: { in: ["ACTIVE", "NOTICE"] } },
    });
    if (existing) throw new AppError(409, "You already have an active PG. Leave it before joining another.");

    const bed = await prisma.bed.findUnique({ where: { id: invitation.bedId }, include: { room: true } });
    if (!bed) throw new AppError(409, "The assigned bed no longer exists.");
    if (bed.activeResidencyId) throw new AppError(409, "That bed has been taken. Ask the owner for another bed.");

    const residency = await prisma.$transaction(async (tx) => {
      const created = await tx.residency.create({
        data: {
          residentId: req.user!.id,
          pgId: invitation.pgId,
          floorId: invitation.floorId,
          roomId: invitation.roomId,
          bedId: invitation.bedId,
          status: "ACTIVE",
          monthlyRent: invitation.monthlyRent,
          joinedAt: new Date(),
        },
      });
      await tx.bed.update({ where: { id: invitation.bedId }, data: { activeResidencyId: created.id } });
      await tx.pgInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date(), residentId: req.user!.id },
      });
      await tx.pgInvitation.updateMany({
        where: { residentId: req.user!.id, status: "PENDING", id: { not: invitation.id } },
        data: { status: "DECLINED" },
      });
      return created;
    });

    await notifyUsers([invitation.pg.ownerId], {
      type: "RESIDENCY",
      title: "Invitation accepted",
      body: `${req.user!.name} joined ${invitation.pg.name}, room ${bed.room.number}.`,
      link: "/owner/residents",
    });
    await recordAudit({
      actorId: req.user!.id,
      action: "INVITATION_ACCEPTED",
      entityType: "Residency",
      entityId: residency.id,
      description: `${req.user!.name} joined ${invitation.pg.name}`,
    });

    res.json({ message: `Welcome to ${invitation.pg.name}.`, residencyId: residency.id });
  })
);

router.post(
  "/invitations/:id/decline",
  ah(async (req, res) => {
    const invitation = await prisma.pgInvitation.findFirst({
      where: { id: req.params.id, status: "PENDING", OR: [{ residentId: req.user!.id }, { email: req.user!.email }] },
    });
    if (!invitation) throw new AppError(404, "Invitation not found.");
    await prisma.pgInvitation.update({ where: { id: invitation.id }, data: { status: "DECLINED" } });
    const pg = await prisma.pg.findUnique({ where: { id: invitation.pgId }, select: { ownerId: true, name: true } });
    if (pg) {
      await notifyUsers([pg.ownerId], {
        type: "RESIDENCY",
        title: "Invitation declined",
        body: `${req.user!.name} declined the invitation to ${pg.name}.`,
        link: "/owner/residents",
      });
    }
    res.json({ message: "Invitation declined." });
  })
);

router.post(
  "/move-out-request",
  ah(async (req, res) => {
    const residency = await activeResidencyForUser(req.user!.id);
    if (!residency) throw new AppError(409, "You do not have an active residency.");
    if (residency.status === "NOTICE") throw new AppError(409, "Your move-out request is already with the owner.");
    const data = parse(z.object({ reason: z.string().trim().max(400).optional() }), req.body);
    await prisma.residency.update({
      where: { id: residency.id },
      data: { status: "NOTICE", noticeDate: new Date(), exitReason: data.reason || null },
    });
    await notifyUsers([residency.pg.ownerId], {
      type: "RESIDENCY",
      title: "Move-out request",
      body: `${req.user!.name} wants to leave ${residency.pg.name}. ${data.reason ?? ""}`.trim(),
      link: "/owner/residents",
    });
    res.json({ message: "Your move-out request was sent to the owner." });
  })
);

export default router;
