import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ah, AppError, parse } from "../lib/http";
import { authenticate, requireRole } from "../lib/auth";
import { notifyUsers, recordAudit } from "../lib/audit";
import { monthKey, monthLabel, shiftMonth } from "../lib/dates";
import { jsonList } from "../lib/serialize";
import { env } from "../lib/env";
import { mailConfigured } from "../lib/mailer";

const router = Router();

router.use(authenticate);
router.use(requireRole("SUPER_ADMIN"));

const monthsBack = (count: number) => {
  const current = monthKey();
  return Array.from({ length: count }, (_, i) => shiftMonth(current, -(count - 1 - i)));
};

const monthOf = (date: Date) => dateKey(date);
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

router.get(
  "/stats",
  ah(async (_req, res) => {
    const [users, pgs, beds, residencies, rentRecords, complaints] = await Promise.all([
      prisma.user.findMany({ select: { id: true, role: true, status: true, createdAt: true, name: true } }),
      prisma.pg.findMany({
        select: { id: true, name: true, status: true, createdAt: true, ownerId: true, type: true, city: true },
      }),
      prisma.bed.findMany({ select: { id: true, activeResidencyId: true, pgId: true } }),
      prisma.residency.findMany({ select: { id: true, status: true, createdAt: true, pgId: true } }),
      prisma.rentRecord.findMany({ select: { amountDue: true, amountPaid: true, periodMonth: true, pgId: true } }),
      prisma.complaint.findMany({ select: { id: true, status: true, category: true, createdAt: true, pgId: true } }),
    ]);

    const owners = users.filter((u) => u.role === "PG_OWNER");
    const residents = users.filter((u) => u.role === "RESIDENT");
    const activeResidencies = residencies.filter((r) => ["ACTIVE", "NOTICE"].includes(r.status));
    const occupiedBeds = beds.filter((b) => b.activeResidencyId).length;
    const current = monthKey();
    const thisMonth = rentRecords.filter((r) => r.periodMonth === current);
    const months = monthsBack(6);

    const monthlySignups = months.map((month) => ({
      month,
      label: monthLabel(month).split(" ")[0].slice(0, 3),
      owners: owners.filter((o) => monthOf(o.createdAt) === month).length,
      residents: residents.filter((r) => monthOf(r.createdAt) === month).length,
      pgs: pgs.filter((p) => monthOf(p.createdAt) === month).length,
    }));

    const rentSeries = months.map((month) => {
      const rows = rentRecords.filter((r) => r.periodMonth === month);
      return {
        month,
        label: monthLabel(month).split(" ")[0].slice(0, 3),
        collected: rows.reduce((s, r) => s + r.amountPaid, 0),
        outstanding: rows.reduce((s, r) => s + Math.max(r.amountDue - r.amountPaid, 0), 0),
      };
    });

    const complaintByCategory = Object.entries(
      complaints.reduce<Record<string, number>>((acc, c) => {
        acc[c.category] = (acc[c.category] ?? 0) + 1;
        return acc;
      }, {})
    ).map(([category, count]) => ({ category, count }));

    const pendingOwners = owners.filter((o) => o.status === "PENDING");
    const pendingPgs = pgs.filter((p) => p.status === "PENDING");

    const audit = await prisma.auditLog.findMany({
      include: { actor: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    res.json({
      stats: {
        totalOwners: owners.length,
        pendingOwners: pendingOwners.length,
        totalProperties: pgs.length,
        pendingProperties: pendingPgs.length,
        totalResidents: residents.length,
        activeResidents: activeResidencies.length,
        totalBeds: beds.length,
        occupiedBeds,
        vacantBeds: beds.length - occupiedBeds,
        occupancyRate: beds.length ? Math.round((occupiedBeds / beds.length) * 100) : 0,
        rentTracked: rentRecords.reduce((s, r) => s + r.amountDue, 0),
        rentCollected: rentRecords.reduce((s, r) => s + r.amountPaid, 0),
        outstanding: rentRecords.reduce((s, r) => s + Math.max(r.amountDue - r.amountPaid, 0), 0),
        monthCollected: thisMonth.reduce((s, r) => s + r.amountPaid, 0),
        totalComplaints: complaints.length,
        openComplaints: complaints.filter((c) => !["RESOLVED", "CLOSED"].includes(c.status)).length,
      },
      monthlySignups,
      rentSeries,
      complaintByCategory,
      complaintByStatus: ["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((status) => ({
        status,
        count: complaints.filter((c) => c.status === status).length,
      })),
      pendingApprovals: {
        owners: pendingOwners.map((o) => ({ id: o.id, name: o.name })),
        properties: pendingPgs.map((p) => ({ id: p.id, name: p.name, city: p.city })),
      },
      occupancyByPg: pgs.slice(0, 6).map((pg) => {
        const pgBeds = beds.filter((b) => b.pgId === pg.id);
        const filled = pgBeds.filter((b) => b.activeResidencyId).length;
        return { id: pg.id, name: pg.name, beds: pgBeds.length, filled, vacant: pgBeds.length - filled };
      }),
      recentActivity: audit.map((a) => ({
        id: a.id,
        description: a.description,
        action: a.action,
        actorName: a.actor?.name ?? "System",
        createdAt: a.createdAt,
      })),
    });
  })
);

router.get(
  "/owners",
  ah(async (req, res) => {
    const query = parse(
      z.object({ search: z.string().optional(), status: z.string().optional() }),
      req.query
    );
    const owners = await prisma.user.findMany({
      where: {
        role: "PG_OWNER",
        ...(query.status && query.status !== "ALL" ? { status: query.status } : {}),
        ...(query.search
          ? { OR: [{ name: { contains: query.search } }, { email: { contains: query.search } }] }
          : {}),
      },
      include: {
        ownedPgs: {
          include: { rooms: { include: { beds: true } }, residencies: { where: { status: { in: ["ACTIVE", "NOTICE"] } } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      owners: owners.map((owner) => ({
        id: owner.id,
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        status: owner.status,
        createdAt: owner.createdAt,
        pgCount: owner.ownedPgs.length,
        residentCount: owner.ownedPgs.reduce((s, p) => s + p.residencies.length, 0),
        bedCount: owner.ownedPgs.reduce((s, p) => s + p.rooms.reduce((rs, r) => rs + r.beds.length, 0), 0),
        propertyNames: owner.ownedPgs.map((p) => p.name),
      })),
    });
  })
);

router.patch(
  "/owners/:id/status",
  ah(async (req, res) => {
    const data = parse(z.object({ status: z.enum(["ACTIVE", "PENDING", "SUSPENDED", "REJECTED"]) }), req.body);
    const owner = await prisma.user.findFirst({ where: { id: req.params.id, role: "PG_OWNER" } });
    if (!owner) throw new AppError(404, "Owner not found.");
    const updated = await prisma.user.update({ where: { id: owner.id }, data: { status: data.status } });
    await notifyUsers([owner.id], {
      type: "ACCOUNT",
      title:
        data.status === "ACTIVE"
          ? "Your owner account is approved"
          : data.status === "SUSPENDED"
          ? "Your owner account is suspended"
          : "Your owner account status changed",
      body:
        data.status === "ACTIVE"
          ? "You can now add properties and manage residents."
          : "Contact support if you think this is a mistake.",
      link: "/owner",
    });
    await recordAudit({
      actorId: req.user!.id,
      action: "OWNER_STATUS_CHANGED",
      entityType: "User",
      entityId: owner.id,
      description: `${owner.name} set to ${data.status}`,
    });
    res.json({ owner: { id: updated.id, status: updated.status } });
  })
);

router.get(
  "/properties",
  ah(async (req, res) => {
    const query = parse(
      z.object({ search: z.string().optional(), status: z.string().optional() }),
      req.query
    );
    const pgs = await prisma.pg.findMany({
      where: {
        ...(query.status && query.status !== "ALL" ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search } },
                { city: { contains: query.search } },
                { owner: { name: { contains: query.search } } },
              ],
            }
          : {}),
      },
      include: {
        owner: { select: { id: true, name: true, email: true, status: true } },
        floors: true,
        rooms: { include: { beds: true } },
        residencies: { where: { status: { in: ["ACTIVE", "NOTICE"] } } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      properties: pgs.map((pg) => {
        const beds = pg.rooms.reduce((s, r) => s + r.beds.length, 0);
        const filled = pg.rooms.reduce((s, r) => s + r.beds.filter((b) => b.activeResidencyId).length, 0);
        return {
          id: pg.id,
          name: pg.name,
          city: pg.city,
          state: pg.state,
          type: pg.type,
          status: pg.status,
          images: jsonList(pg.images),
          rentMin: pg.rentMin,
          rentMax: pg.rentMax,
          createdAt: pg.createdAt,
          owner: pg.owner,
          floorCount: pg.floors.length,
          roomCount: pg.rooms.length,
          totalBeds: beds,
          occupiedBeds: filled,
          residentCount: pg.residencies.length,
        };
      }),
    });
  })
);

router.patch(
  "/properties/:id/status",
  ah(async (req, res) => {
    const data = parse(z.object({ status: z.enum(["PENDING", "VERIFIED", "SUSPENDED"]) }), req.body);
    const pg = await prisma.pg.findUnique({ where: { id: req.params.id }, include: { owner: true } });
    if (!pg) throw new AppError(404, "Property not found.");
    await prisma.pg.update({ where: { id: pg.id }, data: { status: data.status } });
    await notifyUsers([pg.ownerId], {
      type: "ACCOUNT",
      title:
        data.status === "VERIFIED"
          ? `${pg.name} is verified`
          : data.status === "SUSPENDED"
          ? `${pg.name} has been suspended`
          : `${pg.name} is under review`,
      body: data.status === "VERIFIED" ? "Your property is now live for residents." : "Contact support for details.",
      link: "/owner/pgs",
    });
    await recordAudit({
      actorId: req.user!.id,
      action: "PG_STATUS_CHANGED",
      entityType: "Pg",
      entityId: pg.id,
      description: `${pg.name} set to ${data.status}`,
    });
    res.json({ message: "Property status updated." });
  })
);

router.get(
  "/residents",
  ah(async (req, res) => {
    const query = parse(
      z.object({ search: z.string().optional(), status: z.string().optional() }),
      req.query
    );
    const residencies = await prisma.residency.findMany({
      where: {
        ...(query.status && query.status !== "ALL" ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { resident: { name: { contains: query.search } } },
                { resident: { email: { contains: query.search } } },
              ],
            }
          : {}),
      },
      include: {
        resident: { select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true } },
        pg: { select: { id: true, name: true, owner: { select: { name: true } } } },
        room: { select: { number: true } },
        floor: { select: { name: true } },
        bed: { select: { label: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      residents: residencies.map((r) => ({
        id: r.id,
        status: r.status,
        monthlyRent: r.monthlyRent,
        joinedAt: r.joinedAt,
        vacatedAt: r.vacatedAt,
        resident: r.resident,
        pgName: r.pg.name,
        ownerName: r.pg.owner.name,
        roomNumber: r.room.number,
        floorName: r.floor.name,
        bedLabel: r.bed?.label ?? null,
      })),
    });
  })
);

router.patch(
  "/users/:id/status",
  ah(async (req, res) => {
    const data = parse(z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) }), req.body);
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new AppError(404, "Account not found.");
    if (user.role === "SUPER_ADMIN") throw new AppError(403, "Administrator accounts cannot be changed here.");
    await prisma.user.update({ where: { id: user.id }, data: { status: data.status } });
    await recordAudit({
      actorId: req.user!.id,
      action: "USER_STATUS_CHANGED",
      entityType: "User",
      entityId: user.id,
      description: `${user.name} set to ${data.status}`,
    });
    res.json({ message: "Account updated." });
  })
);

router.get(
  "/complaints",
  ah(async (req, res) => {
    const query = parse(
      z.object({ status: z.string().optional(), category: z.string().optional(), search: z.string().optional() }),
      req.query
    );
    const rows = await prisma.complaint.findMany({
      where: {
        ...(query.status && query.status !== "ALL" ? { status: query.status } : {}),
        ...(query.category && query.category !== "ALL" ? { category: query.category } : {}),
        ...(query.search
          ? { OR: [{ title: { contains: query.search } }, { resident: { name: { contains: query.search } } }] }
          : {}),
      },
      include: {
        resident: { select: { name: true, email: true } },
        pg: { select: { name: true } },
        residency: { include: { room: { select: { number: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({
      complaints: rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        urgency: row.urgency,
        status: row.status,
        createdAt: row.createdAt,
        residentName: row.resident.name,
        residentEmail: row.resident.email,
        pgName: row.pg.name,
        roomNumber: row.residency?.room.number ?? null,
        images: jsonList(row.images),
      })),
    });
  })
);

router.get(
  "/analytics",
  ah(async (_req, res) => {
    const [pgs, beds, rentRecords, complaints, residencies] = await Promise.all([
      prisma.pg.findMany({ select: { id: true, name: true, city: true, type: true, createdAt: true } }),
      prisma.bed.findMany({ select: { id: true, pgId: true, activeResidencyId: true } }),
      prisma.rentRecord.findMany({ select: { periodMonth: true, amountDue: true, amountPaid: true } }),
      prisma.complaint.findMany({ select: { category: true, status: true, createdAt: true } }),
      prisma.residency.findMany({ select: { status: true, createdAt: true } }),
    ]);
    const months = monthsBack(6);
    res.json({
      occupancyByProperty: pgs.map((pg) => {
        const pgBeds = beds.filter((b) => b.pgId === pg.id);
        const filled = pgBeds.filter((b) => b.activeResidencyId).length;
        return { name: pg.name, city: pg.city, beds: pgBeds.length, filled, rate: pgBeds.length ? Math.round((filled / pgBeds.length) * 100) : 0 };
      }),
      rentTrend: months.map((month) => {
        const rows = rentRecords.filter((r) => r.periodMonth === month);
        const due = rows.reduce((s, r) => s + r.amountDue, 0);
        const paid = rows.reduce((s, r) => s + r.amountPaid, 0);
        return { month, label: monthLabel(month), collected: paid, due, collectionRate: due ? Math.round((paid / due) * 100) : 0 };
      }),
      residencyLifecycle: ["INVITED", "ACTIVE", "NOTICE", "VACATED", "REJECTED"].map((status) => ({
        status,
        count: residencies.filter((r) => r.status === status).length,
      })),
      complaintBreakdown: Object.entries(
        complaints.reduce<Record<string, number>>((acc, c) => {
          acc[c.category] = (acc[c.category] ?? 0) + 1;
          return acc;
        }, {})
      ).map(([category, count]) => ({ category, count })),
      pgTypes: Object.entries(
        pgs.reduce<Record<string, number>>((acc, p) => {
          acc[p.type] = (acc[p.type] ?? 0) + 1;
          return acc;
        }, {})
      ).map(([type, count]) => ({ type, count })),
    });
  })
);

router.get(
  "/audit-logs",
  ah(async (req, res) => {
    const query = parse(z.object({ search: z.string().optional(), take: z.coerce.number().max(200).default(60) }), req.query);
    const rows = await prisma.auditLog.findMany({
      where: query.search ? { description: { contains: query.search } } : undefined,
      include: { actor: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: query.take,
    });
    res.json({
      logs: rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        description: row.description,
        actorName: row.actor?.name ?? "System",
        actorRole: row.actor?.role ?? "SYSTEM",
        createdAt: row.createdAt,
      })),
    });
  })
);

const SETTING_KEYS = ["platformName", "supportEmail", "supportPhone", "autoApproveOwners", "maintenanceMode"] as const;

router.get(
  "/settings",
  ah(async (_req, res) => {
    const rows = await prisma.appSetting.findMany();
    const settings: Record<string, string> = {
      platformName: "PG Manager",
      supportEmail: "support@pgmanager.app",
      supportPhone: "",
      autoApproveOwners: "false",
      maintenanceMode: "false",
    };
    for (const row of rows) settings[row.key] = row.value;
    res.json({ settings, keys: SETTING_KEYS });
  })
);

router.put(
  "/settings",
  ah(async (req, res) => {
    const data = parse(
      z.object({
        platformName: z.string().trim().min(1).optional(),
        supportEmail: z.string().trim().email().optional(),
        supportPhone: z.string().trim().optional(),
        autoApproveOwners: z.enum(["true", "false"]).optional(),
        maintenanceMode: z.enum(["true", "false"]).optional(),
      }),
      req.body
    );
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
    }
    await recordAudit({
      actorId: req.user!.id,
      action: "SETTINGS_UPDATED",
      entityType: "AppSetting",
      description: `${req.user!.name} updated platform settings`,
      meta: data,
    });
    res.json({ message: "Settings saved." });
  })
);

router.post(
  "/broadcast",
  ah(async (req, res) => {
    const data = parse(
      z.object({
        title: z.string().trim().min(3, "Add a title."),
        body: z.string().trim().min(3, "Write the message."),
        role: z.enum(["ALL", "PG_OWNER", "RESIDENT"]).default("ALL"),
      }),
      req.body
    );
    const users = await prisma.user.findMany({
      where: { role: data.role === "ALL" ? undefined : data.role, status: "ACTIVE" },
      select: { id: true },
    });
    await notifyUsers(
      users.map((u) => u.id),
      { type: "PLATFORM", title: data.title, body: data.body, link: "/notifications" }
    );
    await recordAudit({
      actorId: req.user!.id,
      action: "BROADCAST_SENT",
      entityType: "Notification",
      description: `${req.user!.name} broadcast "${data.title}" to ${users.length} accounts`,
    });
    res.json({ message: `Sent to ${users.length} accounts.` });
  })
);

router.get(
  "/emails",
  ah(async (_req, res) => {
    const rows = await prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 60 });
    res.json({
      configured: mailConfigured(),
      fromAddress: env.mail.from,
      teamInbox: env.mail.teamInbox,
      emails: rows.map((row) => ({
        id: row.id,
        to: row.to,
        subject: row.subject,
        status: row.status,
        category: row.category,
        error: row.error,
        createdAt: row.createdAt,
        preview: row.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180),
      })),
    });
  })
);

export default router;
