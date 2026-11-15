import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ah, AppError, parse } from "../lib/http";
import { authenticate, requireRole } from "../lib/auth";
import { recordAudit } from "../lib/audit";
import { floorForOwner, parsePg, parseRoom, pgForOwner, roomForOwner } from "../lib/access";
import { monthKey, monthLabel, shiftMonth, todayKey } from "../lib/dates";
import { jsonList, toJsonList } from "../lib/serialize";

const router = Router();

router.use(authenticate);
router.use(requireRole("PG_OWNER"));

const bedLabels = (count: number) =>
  Array.from({ length: count }, (_, i) => (i < 26 ? String.fromCharCode(65 + i) : `B${i + 1}`));

const pgSchema = z.object({
  name: z.string().trim().min(2, "Give your PG a name."),
  description: z.string().trim().max(1200).optional().default(""),
  address: z.string().trim().min(5, "Enter the full address."),
  city: z.string().trim().min(2, "Enter the city."),
  state: z.string().trim().min(2, "Enter the state."),
  pincode: z.string().trim().min(4, "Enter the pincode."),
  type: z.enum(["BOYS", "GIRLS", "CO_LIVING"]),
  rentMin: z.coerce.number().int().min(0),
  rentMax: z.coerce.number().int().min(0),
  images: z.array(z.string()).default([]),
  facilities: z.array(z.string()).default([]),
  houseRules: z.string().trim().max(2000).optional(),
  checkInRules: z.string().trim().max(1000).optional(),
  checkOutRules: z.string().trim().max(1000).optional(),
  emergencyName: z.string().trim().max(120).optional(),
  emergencyPhone: z.string().trim().max(20).optional(),
});

router.get(
  "/dashboard",
  ah(async (req, res) => {
    const ownerId = req.user!.id;
    const pgs = await prisma.pg.findMany({
      where: { ownerId },
      include: {
        floors: true,
        rooms: { include: { beds: true } },
      },
    });
    const pgIds = pgs.map((p) => p.id);
    const current = monthKey();
    const months = [5, 4, 3, 2, 1, 0].map((offset) => shiftMonth(current, -offset));

    const [rentRecords, complaints, announcements, activeResidents] = await Promise.all([
      prisma.rentRecord.findMany({
        where: { pgId: { in: pgIds }, periodMonth: { in: months } },
        include: { residency: { include: { resident: true, room: true } } },
      }),
      prisma.complaint.findMany({
        where: { pgId: { in: pgIds } },
        include: { resident: true, pg: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.announcement.findMany({
        where: { pgId: { in: pgIds } },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
      prisma.residency.findMany({
        where: { pgId: { in: pgIds }, status: { in: ["ACTIVE", "NOTICE"] } },
        include: { room: true, floor: true, resident: true, bed: true },
      }),
    ]);

    const totalBeds = pgs.reduce(
      (sum, pg) => sum + pg.rooms.reduce((rs, room) => rs + room.beds.length, 0),
      0
    );
    const occupiedBeds = pgs.reduce(
      (sum, pg) =>
        sum + pg.rooms.reduce((rs, room) => rs + room.beds.filter((b) => b.activeResidencyId).length, 0),
      0
    );

    const thisMonth = rentRecords.filter((r) => r.periodMonth === current);
    const collected = thisMonth.reduce((s, r) => s + r.amountPaid, 0);
    const pending = thisMonth.reduce((s, r) => s + Math.max(r.amountDue - r.amountPaid, 0), 0);

    const collectionSeries = months.map((month) => {
      const records = rentRecords.filter((r) => r.periodMonth === month);
      return {
        month,
        label: monthLabel(month).split(" ")[0].slice(0, 3),
        collected: records.reduce((s, r) => s + r.amountPaid, 0),
        pending: records.reduce((s, r) => s + Math.max(r.amountDue - r.amountPaid, 0), 0),
      };
    });

    const pendingRent = thisMonth
      .filter((r) => r.amountPaid < r.amountDue)
      .slice(0, 6)
      .map((r) => ({
        id: r.id,
        residentName: r.residency.resident.name,
        roomNumber: r.residency.room.number,
        amountDue: r.amountDue,
        amountPaid: r.amountPaid,
        status: r.status,
      }));

    res.json({
      stats: {
        totalPgs: pgs.length,
        totalFloors: pgs.reduce((s, p) => s + p.floors.length, 0),
        totalRooms: pgs.reduce((s, p) => s + p.rooms.length, 0),
        totalBeds,
        occupiedBeds,
        vacantBeds: totalBeds - occupiedBeds,
        activeResidents: activeResidents.length,
        collected,
        pending,
        openComplaints: complaints.filter((c) => c.status !== "RESOLVED" && c.status !== "CLOSED").length,
        occupancyRate: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      },
      pgOccupancy: pgs.map((pg) => {
        const beds = pg.rooms.reduce((s, r) => s + r.beds.length, 0);
        const filled = pg.rooms.reduce((s, r) => s + r.beds.filter((b) => b.activeResidencyId).length, 0);
        return { id: pg.id, name: pg.name, beds, filled, vacant: beds - filled };
      }),
      collectionSeries,
      pendingRent,
      recentComplaints: complaints.map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        status: c.status,
        urgency: c.urgency,
        createdAt: c.createdAt,
        residentName: c.resident.name,
        pgName: c.pg.name,
      })),
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        category: a.category,
        createdAt: a.createdAt,
      })),
      residentsAttention: activeResidents.slice(0, 5).map((r) => ({
        id: r.id,
        name: r.resident.name,
        roomNumber: r.room.number,
        floorName: r.floor.name,
      })),
      currentMonth: current,
    });
  })
);

router.get(
  "/pgs",
  ah(async (req, res) => {
    const pgs = await prisma.pg.findMany({
      where: { ownerId: req.user!.id },
      include: {
        floors: { orderBy: { level: "asc" } },
        rooms: { include: { beds: true } },
        residencies: { where: { status: { in: ["ACTIVE", "NOTICE"] } } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      pgs: pgs.map((pg) => {
        const beds = pg.rooms.reduce((s, r) => s + r.beds.length, 0);
        const filled = pg.rooms.reduce((s, r) => s + r.beds.filter((b) => b.activeResidencyId).length, 0);
        return {
          ...parsePg(pg),
          floorCount: pg.floors.length,
          roomCount: pg.rooms.length,
          totalBeds: beds,
          occupiedBeds: filled,
          vacantBeds: beds - filled,
          residentCount: pg.residencies.length,
        };
      }),
    });
  })
);

router.post(
  "/pgs",
  ah(async (req, res) => {
    const data = parse(pgSchema, req.body);
    if (data.rentMax < data.rentMin) throw new AppError(422, "Maximum rent cannot be lower than minimum rent.");
    const pg = await prisma.pg.create({
      data: {
        ...data,
        description: data.description || null,
        images: toJsonList(data.images),
        facilities: toJsonList(data.facilities),
        ownerId: req.user!.id,
        status: "PENDING",
      },
    });
    const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "APPROVAL",
        title: "New PG awaiting verification",
        body: `${pg.name} was submitted by ${req.user!.name}.`,
        link: "/admin/properties",
      })),
    });
    await recordAudit({
      actorId: req.user!.id,
      action: "PG_CREATED",
      entityType: "Pg",
      entityId: pg.id,
      description: `${req.user!.name} created ${pg.name}`,
    });
    res.status(201).json({ pg: parsePg(pg) });
  })
);

router.get(
  "/pgs/:id",
  ah(async (req, res) => {
    const pg = await pgForOwner(req.params.id, req.user!.id);
    const [floors, rooms, residentCount] = await Promise.all([
      prisma.floor.findMany({ where: { pgId: pg.id }, orderBy: { level: "asc" } }),
      prisma.room.findMany({
        where: { pgId: pg.id },
        include: {
          beds: { orderBy: { label: "asc" } },
          residency: { where: { status: { in: ["ACTIVE", "NOTICE"] } }, include: { resident: true } },
        },
        orderBy: { number: "asc" },
      }),
      prisma.residency.count({ where: { pgId: pg.id, status: { in: ["ACTIVE", "NOTICE"] } } }),
    ]);

    const roomsByFloor = floors.map((floor) => {
      const floorRooms = rooms
        .filter((r) => r.floorId === floor.id)
        .map((room) => ({
          ...parseRoom(room),
          beds: room.beds.map((bed) => {
            const occupant = room.residency.find((r) => r.bedId === bed.id);
            return {
              id: bed.id,
              label: bed.label,
              occupied: Boolean(bed.activeResidencyId),
              residentName: occupant?.resident.name ?? null,
            };
          }),
          occupantCount: room.beds.filter((b) => b.activeResidencyId).length,
        }));
      return {
        ...floor,
        rooms: floorRooms,
        totalBeds: floorRooms.reduce((s, r) => s + r.beds.length, 0),
        occupiedBeds: floorRooms.reduce((s, r) => s + r.occupantCount, 0),
      };
    });

    res.json({ pg: parsePg(pg), floors: roomsByFloor, residentCount });
  })
);

router.patch(
  "/pgs/:id",
  ah(async (req, res) => {
    await pgForOwner(req.params.id, req.user!.id);
    const data = parse(
      pgSchema.partial().extend({
        wifiName: z.string().trim().max(120).optional(),
        wifiPassword: z.string().trim().max(120).optional(),
        wifiInstructions: z.string().trim().max(1200).optional(),
        waterTimings: z.string().trim().max(300).optional(),
        laundryTimings: z.string().trim().max(300).optional(),
        cleaningSchedule: z.string().trim().max(300).optional(),
        electricityInfo: z.string().trim().max(600).optional(),
        visitorRules: z.string().trim().max(1000).optional(),
        commonAreaRules: z.string().trim().max(1000).optional(),
        notice: z.string().trim().max(1000).optional(),
      }),
      req.body
    );
    const patch: Record<string, unknown> = { ...data };
    if (data.images) patch.images = toJsonList(data.images);
    if (data.facilities) patch.facilities = toJsonList(data.facilities);
    if (data.description !== undefined) patch.description = data.description || null;
    const pg = await prisma.pg.update({ where: { id: req.params.id }, data: patch });
    await recordAudit({
      actorId: req.user!.id,
      action: "PG_UPDATED",
      entityType: "Pg",
      entityId: pg.id,
      description: `${req.user!.name} updated ${pg.name}`,
    });
    res.json({ pg: parsePg(pg) });
  })
);

router.delete(
  "/pgs/:id",
  ah(async (req, res) => {
    await pgForOwner(req.params.id, req.user!.id);
    const active = await prisma.residency.count({
      where: { pgId: req.params.id, status: { in: ["ACTIVE", "NOTICE"] } },
    });
    if (active > 0) throw new AppError(409, "Vacate all residents before deleting this PG.");
    const pg = await prisma.pg.delete({ where: { id: req.params.id } });
    await recordAudit({
      actorId: req.user!.id,
      action: "PG_DELETED",
      entityType: "Pg",
      entityId: pg.id,
      description: `${req.user!.name} deleted ${pg.name}`,
    });
    res.json({ message: "PG deleted." });
  })
);

router.post(
  "/pgs/:id/floors",
  ah(async (req, res) => {
    const pg = await pgForOwner(req.params.id, req.user!.id);
    const data = parse(
      z.object({
        name: z.string().trim().min(1, "Name this floor."),
        level: z.coerce.number().int().default(0),
      }),
      req.body
    );
    const floor = await prisma.floor.create({ data: { ...data, pgId: pg.id } });
    await recordAudit({
      actorId: req.user!.id,
      action: "FLOOR_CREATED",
      entityType: "Floor",
      entityId: floor.id,
      description: `${req.user!.name} added ${floor.name} to ${pg.name}`,
    });
    res.status(201).json({ floor });
  })
);

router.patch(
  "/floors/:id",
  ah(async (req, res) => {
    await floorForOwner(req.params.id, req.user!.id);
    const data = parse(
      z.object({
        name: z.string().trim().min(1, "Name this floor.").optional(),
        level: z.coerce.number().int().optional(),
      }),
      req.body
    );
    const floor = await prisma.floor.update({ where: { id: req.params.id }, data });
    res.json({ floor });
  })
);

router.delete(
  "/floors/:id",
  ah(async (req, res) => {
    await floorForOwner(req.params.id, req.user!.id);
    const active = await prisma.residency.count({
      where: { floorId: req.params.id, status: { in: ["ACTIVE", "NOTICE"] } },
    });
    if (active > 0) throw new AppError(409, "This floor still has active residents. Vacate or transfer them first.");
    await prisma.floor.delete({ where: { id: req.params.id } });
    res.json({ message: "Floor removed." });
  })
);

const roomSchema = z.object({
  number: z.string().trim().min(1, "Enter a room number."),
  roomType: z.string().trim().default("STANDARD"),
  capacity: z.coerce.number().int().min(1, "At least one bed is required.").max(20),
  rentPerBed: z.coerce.number().int().min(0),
  amenities: z.array(z.string()).default([]),
  status: z.enum(["ACTIVE", "MAINTENANCE"]).default("ACTIVE"),
});

router.post(
  "/floors/:id/rooms",
  ah(async (req, res) => {
    const floor = await floorForOwner(req.params.id, req.user!.id);
    const data = parse(roomSchema, req.body);
    const existing = await prisma.room.findFirst({ where: { pgId: floor.pgId, number: data.number } });
    if (existing) throw new AppError(409, "A room with this number already exists in this PG.");

    const room = await prisma.room.create({
      data: {
        pgId: floor.pgId,
        floorId: floor.id,
        number: data.number,
        roomType: data.roomType,
        capacity: data.capacity,
        rentPerBed: data.rentPerBed,
        amenities: toJsonList(data.amenities),
        status: data.status,
        beds: { create: bedLabels(data.capacity).map((label) => ({ label, pgId: floor.pgId })) },
      },
      include: { beds: true },
    });
    await recordAudit({
      actorId: req.user!.id,
      action: "ROOM_CREATED",
      entityType: "Room",
      entityId: room.id,
      description: `${req.user!.name} added room ${room.number} (${data.capacity} beds) to ${floor.name}`,
    });
    res.status(201).json({ room: parseRoom(room) });
  })
);

router.get(
  "/rooms/:id",
  ah(async (req, res) => {
    const room = await roomForOwner(req.params.id, req.user!.id);
    const residencies = await prisma.residency.findMany({
      where: { roomId: room.id, status: { in: ["ACTIVE", "NOTICE", "INVITED"] } },
      include: { resident: true },
    });
    res.json({
      room: parseRoom(room),
      floor: { id: room.floor.id, name: room.floor.name },
      pg: { id: room.pg.id, name: room.pg.name },
      beds: room.beds.map((bed) => {
        const residency = residencies.find((r) => r.bedId === bed.id);
        return {
          id: bed.id,
          label: bed.label,
          occupied: Boolean(bed.activeResidencyId),
          resident: residency
            ? { id: residency.resident.id, name: residency.resident.name, phone: residency.resident.phone, status: residency.status }
            : null,
        };
      }),
    });
  })
);

router.patch(
  "/rooms/:id",
  ah(async (req, res) => {
    const room = await roomForOwner(req.params.id, req.user!.id);
    const data = parse(roomSchema.partial(), req.body);
    const patch: Record<string, unknown> = { ...data };
    if (data.amenities) patch.amenities = toJsonList(data.amenities);

    if (data.capacity && data.capacity !== room.capacity) {
      const occupied = room.beds.filter((b) => b.activeResidencyId).length;
      if (data.capacity < occupied) {
        throw new AppError(409, `This room has ${occupied} occupied beds. Vacate a resident first.`);
      }
      const currentLabels = room.beds.map((b) => b.label);
      const labels = bedLabels(data.capacity);
      const missing = labels.filter((l) => !currentLabels.includes(l));
      const extra = room.beds.filter((b) => !labels.includes(b.label) && !b.activeResidencyId);
      if (missing.length) {
        await prisma.bed.createMany({
          data: missing.map((label) => ({ label, roomId: room.id, pgId: room.pgId })),
        });
      }
      if (extra.length) {
        await prisma.bed.deleteMany({ where: { id: { in: extra.map((b) => b.id) } } });
      }
    }

    const updated = await prisma.room.update({
      where: { id: room.id },
      data: patch,
      include: { beds: { orderBy: { label: "asc" } } },
    });
    res.json({ room: parseRoom(updated) });
  })
);

router.delete(
  "/rooms/:id",
  ah(async (req, res) => {
    const room = await roomForOwner(req.params.id, req.user!.id);
    const occupied = room.beds.filter((b) => b.activeResidencyId).length;
    if (occupied > 0) throw new AppError(409, "This room still has residents. Transfer or vacate them first.");
    await prisma.room.delete({ where: { id: room.id } });
    res.json({ message: "Room removed." });
  })
);

router.get(
  "/pgs/:id/available-beds",
  ah(async (req, res) => {
    const pg = await pgForOwner(req.params.id, req.user!.id);
    const beds = await prisma.bed.findMany({
      where: { pgId: pg.id, activeResidencyId: null },
      include: { room: { include: { floor: true } } },
      orderBy: [{ room: { number: "asc" } }, { label: "asc" }],
    });
    const invited = await prisma.pgInvitation.findMany({
      where: { pgId: pg.id, status: "PENDING" },
      select: { bedId: true },
    });
    const reserved = new Set(invited.map((i) => i.bedId));
    res.json({
      beds: beds
        .filter((b) => b.room.status === "ACTIVE")
        .map((bed) => ({
          id: bed.id,
          label: bed.label,
          roomId: bed.roomId,
          roomNumber: bed.room.number,
          floorId: bed.room.floorId,
          floorName: bed.room.floor.name,
          rentPerBed: bed.room.rentPerBed,
          reserved: reserved.has(bed.id),
        })),
    });
  })
);

export default router;
