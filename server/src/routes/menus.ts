import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ah, AppError, parse } from "../lib/http";
import { authenticate, requireRole } from "../lib/auth";
import { notifyUsers, recordAudit } from "../lib/audit";
import { activeResidencyForUser, pgForOwner } from "../lib/access";

const router = Router();

router.use(authenticate);

const MEALS = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"] as const;

const mealsSchema = z.object({
  BREAKFAST: z.array(z.string().trim().min(1)).default([]),
  LUNCH: z.array(z.string().trim().min(1)).default([]),
  SNACKS: z.array(z.string().trim().min(1)).default([]),
  DINNER: z.array(z.string().trim().min(1)).default([]),
});

type MenuWithItems = {
  id: string;
  pgId: string;
  date: string;
  note: string | null;
  imageUrl: string | null;
  items: { id: string; meal: string; name: string; description: string | null; sortOrder: number }[];
  pg?: { name: string };
};

const serializeMenu = (menu: MenuWithItems) => {
  const meals: Record<string, string[]> = { BREAKFAST: [], LUNCH: [], SNACKS: [], DINNER: [] };
  for (const item of menu.items.sort((a, b) => a.sortOrder - b.sortOrder)) {
    meals[item.meal] = [...(meals[item.meal] ?? []), item.name];
  }
  return {
    id: menu.id,
    pgId: menu.pgId,
    pgName: menu.pg?.name,
    date: menu.date,
    note: menu.note,
    imageUrl: menu.imageUrl,
    meals,
    itemCount: menu.items.length,
  };
};

router.get(
  "/owner/menus",
  requireRole("PG_OWNER"),
  ah(async (req, res) => {
    const query = parse(
      z.object({ pgId: z.string().optional(), from: z.string().optional(), to: z.string().optional() }),
      req.query
    );
    const menus = await prisma.foodMenu.findMany({
      where: {
        pg: { ownerId: req.user!.id },
        ...(query.pgId ? { pgId: query.pgId } : {}),
        ...(query.from || query.to
          ? { date: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
          : {}),
      },
      include: { items: true, pg: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 60,
    });
    const pgs = await prisma.pg.findMany({ where: { ownerId: req.user!.id }, select: { id: true, name: true } });
    res.json({ menus: menus.map(serializeMenu), pgs });
  })
);

router.put(
  "/owner/menus",
  requireRole("PG_OWNER"),
  ah(async (req, res) => {
    const data = parse(
      z.object({
        pgId: z.string().min(1, "Select a PG."),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
        meals: mealsSchema,
        note: z.string().trim().max(500).optional(),
      }),
      req.body
    );
    const pg = await pgForOwner(data.pgId, req.user!.id);

    const items = MEALS.flatMap((meal) =>
      (data.meals[meal] ?? []).map((name, index) => ({ meal, name, sortOrder: index }))
    );

    const menu = await prisma.$transaction(async (tx) => {
      const existing = await tx.foodMenu.findUnique({ where: { pgId_date: { pgId: pg.id, date: data.date } } });
      if (existing) {
        await tx.foodMenuItem.deleteMany({ where: { menuId: existing.id } });
        return tx.foodMenu.update({
          where: { id: existing.id },
          data: {
            note: data.note || null,
            items: { create: items },
          },
          include: { items: true, pg: { select: { name: true } } },
        });
      }
      return tx.foodMenu.create({
        data: {
          pgId: pg.id,
          date: data.date,
          note: data.note || null,
          items: { create: items },
        },
        include: { items: true, pg: { select: { name: true } } },
      });
    });

    const residents = await prisma.residency.findMany({
      where: { pgId: pg.id, status: { in: ["ACTIVE", "NOTICE"] } },
      select: { residentId: true },
    });
    await notifyUsers(
      residents.map((r) => r.residentId),
      {
        type: "MENU",
        title: "Food menu updated",
        body: `The menu for ${data.date} at ${pg.name} has been updated.`,
        link: "/resident/food",
      }
    );
    await recordAudit({
      actorId: req.user!.id,
      action: "MENU_UPDATED",
      entityType: "FoodMenu",
      entityId: menu.id,
      description: `${req.user!.name} updated the menu for ${data.date} at ${pg.name}`,
    });

    res.json({ menu: serializeMenu(menu) });
  })
);

router.delete(
  "/owner/menus/:id",
  requireRole("PG_OWNER"),
  ah(async (req, res) => {
    const menu = await prisma.foodMenu.findFirst({
      where: { id: req.params.id, pg: { ownerId: req.user!.id } },
    });
    if (!menu) throw new AppError(404, "Menu not found.");
    await prisma.foodMenu.delete({ where: { id: menu.id } });
    res.json({ message: "Menu removed." });
  })
);

router.get(
  "/resident/menu",
  requireRole("RESIDENT"),
  ah(async (req, res) => {
    const residency = await activeResidencyForUser(req.user!.id);
    if (!residency) return res.json({ today: null, upcoming: [], past: [], pgName: null });
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
    const [todayMenu, upcoming, past] = await Promise.all([
      prisma.foodMenu.findUnique({
        where: { pgId_date: { pgId: residency.pgId, date: key } },
        include: { items: true, pg: { select: { name: true } } },
      }),
      prisma.foodMenu.findMany({
        where: { pgId: residency.pgId, date: { gt: key } },
        include: { items: true, pg: { select: { name: true } } },
        orderBy: { date: "asc" },
        take: 7,
      }),
      prisma.foodMenu.findMany({
        where: { pgId: residency.pgId, date: { lt: key } },
        include: { items: true, pg: { select: { name: true } } },
        orderBy: { date: "desc" },
        take: 7,
      }),
    ]);
    res.json({
      pgName: residency.pg.name,
      today: todayMenu ? serializeMenu(todayMenu) : null,
      upcoming: upcoming.map(serializeMenu),
      past: past.map(serializeMenu),
    });
  })
);

export default router;
