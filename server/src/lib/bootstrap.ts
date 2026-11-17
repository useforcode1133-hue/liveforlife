import bcrypt from "bcryptjs";
import { env } from "./env";
import { prisma } from "./prisma";

/**
 * A brand new deployment has an empty database and therefore no way to sign in.
 * When ADMIN_EMAIL and ADMIN_PASSWORD are set, create that super admin once so
 * the very first visit to the site can actually log in. Does nothing afterwards.
 */
export async function bootstrapAdmin(): Promise<void> {
  const email = env.adminEmail.trim().toLowerCase();
  const password = env.adminPassword;

  if (!email || !password) return;

  const existing = await prisma.user.count();
  if (existing > 0) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name: env.adminName || "Super Admin",
      email,
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`[api] created first super admin for ${email}`);
}
