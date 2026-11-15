import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ah, AppError, parse } from "../lib/http";
import { authenticate, signToken } from "../lib/auth";
import { notifyUsers, recordAudit } from "../lib/audit";
import { env } from "../lib/env";
import { mailConfigured, notifyTeam, resetPasswordEmail, sendMail, teamAlertEmail } from "../lib/mailer";

const router = Router();

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");
const passwordSchema = z.string().min(8, "Use at least 8 characters.");

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  email: emailSchema,
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  password: passwordSchema,
  role: z.enum(["PG_OWNER", "RESIDENT"]),
  inviteCode: z.string().trim().optional(),
});

const publicUser = (user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  avatarUrl: string | null;
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  avatarUrl: user.avatarUrl,
});

router.post(
  "/register",
  ah(async (req, res) => {
    const data = parse(registerSchema, req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError(409, "An account with this email already exists. Try signing in.");

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        passwordHash,
        role: data.role,
        status: data.role === "PG_OWNER" ? "PENDING" : "ACTIVE",
        preferences: { create: {} },
      },
    });

    if (data.role === "PG_OWNER") {
      const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
      await notifyUsers(
        admins.map((a) => a.id),
        {
          type: "APPROVAL",
          title: "New owner awaiting approval",
          body: `${user.name} registered as a PG owner.`,
          link: "/admin/owners",
        }
      );
      await sendMail({
        to: user.email,
        subject: "Your PG Manager owner account is being reviewed",
        html: `<p>Hi ${user.name},</p><p>Thanks for signing up as a PG owner. An administrator will verify your account shortly, and you can add properties as soon as it is approved.</p><p>— PG Manager</p>`,
        category: "ACCOUNT",
      });
      await notifyTeam(
        `New PG owner signup: ${user.name}`,
        teamAlertEmail({
          heading: "New owner awaiting approval",
          lines: [`Name: ${user.name}`, `Email: ${user.email}`, `Phone: ${user.phone ?? "not provided"}`],
          link: `${env.publicUrl}/admin/owners?status=PENDING`,
        }),
        "TEAM"
      );
      await recordAudit({
        actorId: user.id,
        action: "OWNER_REGISTERED",
        entityType: "User",
        entityId: user.id,
        description: `${user.name} registered as a PG owner`,
      });
    }

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

router.post(
  "/login",
  ah(async (req, res) => {
    const data = parse(
      z.object({ email: emailSchema, password: z.string().min(1, "Enter your password.") }),
      req.body
    );
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) throw new AppError(401, "Email or password is incorrect.");
    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) throw new AppError(401, "Email or password is incorrect.");
    if (user.status === "SUSPENDED") throw new AppError(403, "This account is suspended. Contact support.");
    if (user.status === "REJECTED") throw new AppError(403, "This account was not approved.");
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

router.get(
  "/me",
  authenticate,
  ah(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { preferences: true },
    });
    if (!user) throw new AppError(404, "Account not found.");
    res.json({ user: { ...publicUser(user), preferences: user.preferences } });
  })
);

router.patch(
  "/profile",
  authenticate,
  ah(async (req, res) => {
    const data = parse(
      z.object({
        name: z.string().trim().min(2, "Enter your full name.").optional(),
        phone: z.string().trim().max(20).optional(),
        avatarUrl: z.string().trim().max(600).nullable().optional(),
        currentPassword: z.string().optional(),
        newPassword: passwordSchema.optional(),
      }),
      req.body
    );

    const updates: Record<string, unknown> = {};
    if (data.name) updates.name = data.name;
    if (data.phone !== undefined) updates.phone = data.phone || null;
    if (data.avatarUrl !== undefined) updates.avatarUrl = data.avatarUrl || null;

    if (data.newPassword) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
      if (!data.currentPassword) throw new AppError(422, "Enter your current password to change it.");
      const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!valid) throw new AppError(422, "Your current password is incorrect.");
      updates.passwordHash = await bcrypt.hash(data.newPassword, 10);
    }

    const user = await prisma.user.update({ where: { id: req.user!.id }, data: updates });
    res.json({ user: publicUser(user) });
  })
);

router.put(
  "/notification-preferences",
  authenticate,
  ah(async (req, res) => {
    const data = parse(
      z.object({
        rentReminders: z.boolean(),
        announcements: z.boolean(),
        menuUpdates: z.boolean(),
        complaintUpdates: z.boolean(),
      }),
      req.body
    );
    const preferences = await prisma.notificationPreference.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, ...data },
      update: data,
    });
    res.json({ preferences });
  })
);

router.post(
  "/forgot-password",
  ah(async (req, res) => {
    const data = parse(z.object({ email: emailSchema }), req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      return res.json({ message: "If that email is registered, a reset link is on its way." });
    }
    const token = crypto.randomBytes(24).toString("hex");
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenAt: new Date() },
    });
    await recordAudit({
      actorId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      entityType: "User",
      entityId: user.id,
      description: `${user.name} requested a password reset`,
    });
    const delivery = await sendMail({
      to: user.email,
      subject: "Reset your PG Manager password",
      html: resetPasswordEmail({ name: user.name, token }),
      category: "PASSWORD_RESET",
    });

    res.json({
      message: "If that email is registered, a reset link is on its way.",
      // Only surface the token when no mailbox is connected, so the flow is
      // usable locally without pretending an email was delivered.
      resetToken: delivery.sent || mailConfigured() || env.isProduction ? undefined : token,
    });
  })
);

router.post(
  "/reset-password",
  ah(async (req, res) => {
    const data = parse(
      z.object({ token: z.string().min(10, "This reset link is not valid."), password: passwordSchema }),
      req.body
    );
    const user = await prisma.user.findFirst({ where: { resetToken: data.token } });
    if (!user || !user.resetTokenAt) throw new AppError(400, "This reset link has expired. Request a new one.");
    const ageMs = Date.now() - user.resetTokenAt.getTime();
    if (ageMs > 1000 * 60 * 60 * 2) throw new AppError(400, "This reset link has expired. Request a new one.");
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(data.password, 10), resetToken: null, resetTokenAt: null },
    });
    res.json({ message: "Your password has been updated. You can sign in now." });
  })
);

export default router;
