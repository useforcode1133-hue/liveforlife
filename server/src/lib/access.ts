import { prisma } from "./prisma";
import { AppError } from "./http";
import { jsonList } from "./serialize";
import type { Pg, Residency, Room } from "@prisma/client";

/** Load a PG only when it belongs to the given owner (data isolation). */
export async function pgForOwner(pgId: string, ownerId: string) {
  const pg = await prisma.pg.findFirst({ where: { id: pgId, ownerId } });
  if (!pg) throw new AppError(404, "That PG was not found in your account.");
  return pg;
}

export async function roomForOwner(roomId: string, ownerId: string) {
  const room = await prisma.room.findFirst({
    where: { id: roomId, pg: { ownerId } },
    include: { pg: true, floor: true, beds: { orderBy: { label: "asc" } } },
  });
  if (!room) throw new AppError(404, "That room was not found in your account.");
  return room;
}

export async function floorForOwner(floorId: string, ownerId: string) {
  const floor = await prisma.floor.findFirst({
    where: { id: floorId, pg: { ownerId } },
    include: { pg: true, rooms: true },
  });
  if (!floor) throw new AppError(404, "That floor was not found in your account.");
  return floor;
}

export async function residencyForOwner(residencyId: string, ownerId: string) {
  const residency = await prisma.residency.findFirst({
    where: { id: residencyId, pg: { ownerId } },
    include: { resident: true, pg: true, floor: true, room: true, bed: true },
  });
  if (!residency) throw new AppError(404, "That resident row was not found in your account.");
  return residency;
}

export async function activeResidencyForUser(userId: string) {
  return prisma.residency.findFirst({
    where: { residentId: userId, status: { in: ["ACTIVE", "NOTICE"] } },
    include: {
      pg: true,
      floor: true,
      room: true,
      bed: true,
      resident: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export function parsePg(pg: Pg) {
  return { ...pg, images: jsonList(pg.images), facilities: jsonList(pg.facilities) };
}

export function parseRoom(room: Room) {
  return { ...room, amenities: jsonList(room.amenities) };
}

export type RoomWithBeds = Room & { beds: { id: string; label: string; activeResidencyId: string | null }[] };

/** Occupancy derived from real bed allocation, never from counters. */
export function roomStats(room: { capacity: number; beds: { activeResidencyId: string | null }[] }) {
  const total = room.beds.length || room.capacity;
  const occupied = room.beds.filter((b) => b.activeResidencyId).length;
  return { totalBeds: total, occupiedBeds: occupied, vacantBeds: Math.max(total - occupied, 0) };
}

export function residencyStatusLabel(status: string) {
  return (
    {
      INVITED: "Invited",
      ACTIVE: "Active",
      NOTICE: "Notice period",
      VACATED: "Vacated",
      REJECTED: "Rejected",
    } as Record<string, string>
  )[status] ?? status;
}

export type ResidencyRow = Residency & {
  resident: { id: string; name: string; email: string; phone: string | null };
  room: { number: string };
  floor: { name: string };
  bed: { label: string } | null;
};

export function mapResidency(row: ResidencyRow) {
  return {
    id: row.id,
    status: row.status,
    monthlyRent: row.monthlyRent,
    securityDeposit: row.securityDeposit,
    joinedAt: row.joinedAt,
    vacatedAt: row.vacatedAt,
    noticeDate: row.noticeDate,
    exitReason: row.exitReason,
    resident: row.resident,
    roomNumber: row.room.number,
    floorName: row.floor.name,
    bedLabel: row.bed?.label ?? null,
    pgId: row.pgId,
    floorId: row.floorId,
    roomId: row.roomId,
    bedId: row.bedId,
  };
}
