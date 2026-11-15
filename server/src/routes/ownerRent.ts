import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ah, AppError, parse } from "../lib/http";
import { authenticate, requireRole } from "../lib/auth";
import { notifyUsers, recordAudit } from "../lib/audit";
import { dueDateFor, monthKey, monthLabel } from "../lib/dates";
import { rentReminderEmail, sendMail } from "../lib/mailer";

const router = Router();

router.use(authenticate);
router.use(requireRole("PG_OWNER"));

const effectiveStatus = (record: { status: string; dueDate: Date; amountPaid: number; amountDue: number }) => {
  if (record.amountPaid >= record.amountDue) return "PAID";
  if (record.amountPaid > 0) return "PARTIAL";
  if (record.dueDate < new Date()) return "OVERDUE";
  return record.status === "PARTIAL" ? "PARTIAL" : "UNPAID";
};

router.get(
  "/rent",
  ah(async (req, res) => {
    const query = parse(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        pgId: z.string().optional(),
        status: z.string().optional(),
        search: z.string().optional(),
      }),
      req.query
    );
    const month = query.month ?? monthKey();
    const ownerId = req.user!.id;

    const pgs = await prisma.pg.findMany({ where: { ownerId }, select: { id: true, name: true } });
    const records = await prisma.rentRecord.findMany({
      where: {
        pgId: query.pgId ? query.pgId : { in: pgs.map((p) => p.id) },
        periodMonth: month,
        ...(query.search
          ? { residency: { resident: { name: { contains: query.search } } } }
          : {}),
      },
      include: {
        residency: {
          include: {
            resident: { select: { id: true, name: true, email: true, phone: true } },
            room: { select: { number: true } },
            floor: { select: { name: true } },
          },
        },
        pg: { select: { id: true, name: true } },
        payments: { orderBy: { paidAt: "desc" } },
      },
      orderBy: { dueDate: "asc" },
    });

    const rows = records
      .map((record) => ({
        id: record.id,
        month: record.periodMonth,
        amountDue: record.amountDue,
        amountPaid: record.amountPaid,
        balance: Math.max(record.amountDue - record.amountPaid, 0),
        dueDate: record.dueDate,
        status: effectiveStatus(record),
        notes: record.notes,
        resident: record.residency.resident,
        roomNumber: record.residency.room.number,
        floorName: record.residency.floor.name,
        pgId: record.pg.id,
        pgName: record.pg.name,
        residencyId: record.residencyId,
        payments: record.payments,
      }))
      .filter((row) => !query.status || query.status === "ALL" || row.status === query.status);

    const summary = {
      month,
      monthLabel: monthLabel(month),
      totalDue: records.reduce((s, r) => s + r.amountDue, 0),
      totalCollected: records.reduce((s, r) => s + r.amountPaid, 0),
      totalOutstanding: records.reduce((s, r) => s + Math.max(r.amountDue - r.amountPaid, 0), 0),
      paidCount: records.filter((r) => r.amountPaid >= r.amountDue).length,
      unpaidCount: records.filter((r) => r.amountPaid < r.amountDue).length,
    };

    res.json({ rows, summary, pgs });
  })
);

router.post(
  "/rent/generate",
  ah(async (req, res) => {
    const data = parse(
      z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), pgId: z.string().optional() }),
      req.body
    );
    const pgs = await prisma.pg.findMany({
      where: { ownerId: req.user!.id, ...(data.pgId ? { id: data.pgId } : {}) },
      select: { id: true },
    });
    const residencies = await prisma.residency.findMany({
      where: { pgId: { in: pgs.map((p) => p.id) }, status: { in: ["ACTIVE", "NOTICE"] } },
    });
    const existing = await prisma.rentRecord.findMany({
      where: { periodMonth: data.month, residencyId: { in: residencies.map((r) => r.id) } },
      select: { residencyId: true },
    });
    const have = new Set(existing.map((e) => e.residencyId));
    const toCreate = residencies.filter((r) => !have.has(r.id));

    if (toCreate.length) {
      await prisma.rentRecord.createMany({
        data: toCreate.map((residency) => ({
          residencyId: residency.id,
          pgId: residency.pgId,
          periodMonth: data.month,
          amountDue: residency.monthlyRent,
          amountPaid: 0,
          status: "UNPAID",
          dueDate: dueDateFor(data.month),
        })),
      });
      await recordAudit({
        actorId: req.user!.id,
        action: "RENT_GENERATED",
        entityType: "RentRecord",
        description: `${req.user!.name} generated ${toCreate.length} rent records for ${data.month}`,
      });
    }

    res.json({ created: toCreate.length, month: data.month });
  })
);

router.get(
  "/rent/:id",
  ah(async (req, res) => {
    const record = await prisma.rentRecord.findFirst({
      where: { id: req.params.id, pg: { ownerId: req.user!.id } },
      include: {
        residency: {
          include: {
            resident: true,
            room: true,
            floor: true,
            pg: true,
          },
        },
        payments: { include: { recordedBy: { select: { name: true } } }, orderBy: { paidAt: "desc" } },
      },
    });
    if (!record) throw new AppError(404, "Rent record not found.");
    res.json({ record: { ...record, status: effectiveStatus(record) } });
  })
);

router.post(
  "/rent/:id/pay",
  ah(async (req, res) => {
    const record = await prisma.rentRecord.findFirst({
      where: { id: req.params.id, pg: { ownerId: req.user!.id } },
      include: { residency: { include: { resident: true, room: true, pg: true } } },
    });
    if (!record) throw new AppError(404, "Rent record not found.");

    const data = parse(
      z.object({
        amount: z.coerce.number().int().min(1, "Enter the amount received."),
        method: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CARD", "OTHER"]),
        reference: z.string().trim().max(120).optional(),
        note: z.string().trim().max(300).optional(),
        paidAt: z.string().optional(),
      }),
      req.body
    );

    const balance = Math.max(record.amountDue - record.amountPaid, 0);
    if (data.amount > balance) {
      throw new AppError(422, `The balance for this month is ₹${balance}. Enter that amount or less.`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          rentRecordId: record.id,
          amount: data.amount,
          method: data.method,
          reference: data.reference || null,
          note: data.note || null,
          paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
          recordedById: req.user!.id,
        },
      });
      const amountPaid = record.amountPaid + data.amount;
      const paid = amountPaid >= record.amountDue;
      return tx.rentRecord.update({
        where: { id: record.id },
        data: {
          amountPaid,
          status: paid ? "PAID" : "PARTIAL",
          paidAt: paid ? new Date() : record.paidAt,
        },
        include: { payments: { orderBy: { paidAt: "desc" } } },
      });
    });

    await notifyUsers([record.residency.residentId], {
      type: "RENT",
      title: updated.status === "PAID" ? "Rent payment confirmed" : "Partial rent payment recorded",
      body:
        updated.status === "PAID"
          ? `₹${data.amount} received for ${monthLabel(record.periodMonth)}. Thank you.`
          : `₹${data.amount} received. ₹${updated.amountDue - updated.amountPaid} still due for ${monthLabel(
              record.periodMonth
            )}.`,
      link: "/resident/rent",
    });
    await recordAudit({
      actorId: req.user!.id,
      action: "RENT_PAID",
      entityType: "RentRecord",
      entityId: record.id,
      description: `${req.user!.name} recorded ₹${data.amount} rent from ${record.residency.resident.name}`,
    });

    res.json({ record: { ...updated, status: effectiveStatus(updated) } });
  })
);

router.patch(
  "/rent/:id",
  ah(async (req, res) => {
    const record = await prisma.rentRecord.findFirst({
      where: { id: req.params.id, pg: { ownerId: req.user!.id } },
    });
    if (!record) throw new AppError(404, "Rent record not found.");
    const data = parse(
      z.object({
        amountDue: z.coerce.number().int().min(0).optional(),
        dueDate: z.string().optional(),
        notes: z.string().trim().max(400).optional(),
      }),
      req.body
    );
    if (data.amountDue !== undefined && data.amountDue < record.amountPaid) {
      throw new AppError(422, "Rent due cannot be less than what has already been paid.");
    }
    const updated = await prisma.rentRecord.update({
      where: { id: record.id },
      data: {
        ...(data.amountDue !== undefined ? { amountDue: data.amountDue } : {}),
        ...(data.dueDate ? { dueDate: new Date(data.dueDate) } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      },
    });
    res.json({ record: { ...updated, status: effectiveStatus(updated) } });
  })
);

router.post(
  "/rent/:id/remind",
  ah(async (req, res) => {
    const record = await prisma.rentRecord.findFirst({
      where: { id: req.params.id, pg: { ownerId: req.user!.id } },
      include: { residency: { include: { resident: true } }, pg: true },
    });
    if (!record) throw new AppError(404, "Rent record not found.");
    const balance = Math.max(record.amountDue - record.amountPaid, 0);
    if (balance === 0) throw new AppError(409, "This month is already fully paid.");
    await notifyUsers([record.residency.residentId], {
      type: "RENT",
      title: `Rent reminder for ${monthLabel(record.periodMonth)}`,
      body: `₹${balance} is pending for ${record.pg.name}. Please pay at your earliest convenience.`,
      link: "/resident/rent",
    });
    await sendMail({
      to: record.residency.resident.email,
      subject: `Rent reminder for ${monthLabel(record.periodMonth)}`,
      html: rentReminderEmail({
        name: record.residency.resident.name,
        pgName: record.pg.name,
        month: monthLabel(record.periodMonth),
        balance: `₹${balance.toLocaleString("en-IN")}`,
      }),
      category: "RENT_REMINDER",
    });
    res.json({ message: "Reminder sent." });
  })
);

router.post(
  "/rent/remind-all",
  ah(async (req, res) => {
    const data = parse(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }), req.body);
    const records = await prisma.rentRecord.findMany({
      where: { periodMonth: data.month, pg: { ownerId: req.user!.id } },
      include: { residency: true, pg: true },
    });
    const due = records.filter((r) => r.amountPaid < r.amountDue);
    for (const record of due) {
      const balance = record.amountDue - record.amountPaid;
      await notifyUsers([record.residency.residentId], {
        type: "RENT",
        title: `Rent reminder for ${monthLabel(record.periodMonth)}`,
        body: `₹${balance} is pending for ${record.pg.name}.`,
        link: "/resident/rent",
      });
      const resident = await prisma.user.findUnique({ where: { id: record.residency.residentId }, select: { email: true, name: true } });
      if (resident) {
        await sendMail({
          to: resident.email,
          subject: `Rent reminder for ${monthLabel(record.periodMonth)}`,
          html: rentReminderEmail({
            name: resident.name,
            pgName: record.pg.name,
            month: monthLabel(record.periodMonth),
            balance: `₹${balance.toLocaleString("en-IN")}`,
          }),
          category: "RENT_REMINDER",
        });
      }
    }
    res.json({ message: `Reminders sent to ${due.length} residents.` });
  })
);

export default router;
