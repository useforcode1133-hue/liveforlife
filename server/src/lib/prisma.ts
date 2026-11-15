import "dotenv/config";
import { PrismaClient } from "@prisma/client";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://pguser@127.0.0.1:55432/pgmanager?schema=public";

export const prisma = new PrismaClient();
