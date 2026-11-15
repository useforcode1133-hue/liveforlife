import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "./prisma";
import { env } from "./env";

/**
 * Outgoing mail.
 *
 * Every message is written to the EmailLog outbox first, so nothing is silently
 * lost. When SMTP_HOST is configured the message is delivered over SMTP and the
 * log row is marked SENT (or FAILED with the provider error). Without SMTP the
 * message stays QUEUED and is printed to the server log, which keeps local
 * development usable without credentials.
 */

let cachedTransport: Transporter | null | undefined;

function transport(): Transporter | null {
  if (cachedTransport !== undefined) return cachedTransport;
  if (!env.mail.host) {
    cachedTransport = null;
    return cachedTransport;
  }
  cachedTransport = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure,
    auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
    connectionTimeout: 10_000,
  });
  return cachedTransport;
}

export const mailConfigured = () => Boolean(env.mail.host);

interface SendInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  category?: string;
}

export async function sendMail({ to, subject, html, text, category = "GENERAL" }: SendInput) {
  const log = await prisma.emailLog.create({
    data: { to, subject, body: html, category, status: "QUEUED" },
  });

  const activeTransport = transport();
  if (!activeTransport) {
    console.log(`[mail] queued (SMTP not configured) -> ${to}: ${subject}`);
    return { sent: false, id: log.id, reason: "SMTP not configured" };
  }

  try {
    await activeTransport.sendMail({
      from: env.mail.from,
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });
    await prisma.emailLog.update({ where: { id: log.id }, data: { status: "SENT" } });
    return { sent: true, id: log.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown mail error";
    await prisma.emailLog.update({ where: { id: log.id }, data: { status: "FAILED", error: message } });
    console.error(`[mail] failed -> ${to}: ${message}`);
    return { sent: false, id: log.id, reason: message };
  }
}

export async function notifyTeam(subject: string, html: string, category = "TEAM") {
  if (!env.mail.teamInbox) return { sent: false, reason: "TEAM_INBOX not configured" };
  return sendMail({ to: env.mail.teamInbox, subject, html, category });
}

/* ------------------------------------------------------------------ templates */

const shell = (title: string, body: string, footer = "PG Manager") => `<!doctype html>
<html><body style="margin:0;padding:24px;background:#F7F8FC;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#24243A">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #ECEDF5">
    <tr><td style="background:linear-gradient(135deg,#6C5CE7,#4D96FF);padding:22px 26px">
      <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.2px">PG Manager</span>
    </td></tr>
    <tr><td style="padding:26px">
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#24243A">${title}</h1>
      <div style="font-size:14px;line-height:1.65;color:#4A4A63">${body}</div>
    </td></tr>
    <tr><td style="padding:16px 26px;background:#F7F8FC;color:#77788A;font-size:12px">${footer}</td></tr>
  </table>
</body></html>`;

const button = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${href}" style="display:inline-block;background:#6C5CE7;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:600">${label}</a></p>`;

export const invitationEmail = (input: {
  recipientName: string;
  ownerName: string;
  pgName: string;
  roomNumber: string;
  bedLabel: string;
  rent: string;
  code: string;
}) =>
  shell(
    `You are invited to ${input.pgName}`,
    `<p>Hi ${input.recipientName},</p>
     <p><strong>${input.ownerName}</strong> has reserved a bed for you at <strong>${input.pgName}</strong>.</p>
     <p style="background:#F7F8FC;border-radius:12px;padding:14px 16px">
       Room <strong>${input.roomNumber}</strong> · Bed <strong>${input.bedLabel}</strong><br/>
       Monthly rent <strong>${input.rent}</strong><br/>
       Invitation code <strong style="letter-spacing:2px">${input.code}</strong>
     </p>
     ${button(`${env.publicUrl}/join/${input.code}`, "Review and accept")}
     <p>If the button does not work, open ${env.publicUrl}/join/${input.code} and sign in or create a free resident account.</p>`,
    "You received this because a PG owner invited you. Ignore it if this was not meant for you."
  );

export const resetPasswordEmail = (input: { name: string; token: string }) =>
  shell(
    "Reset your PG Manager password",
    `<p>Hi ${input.name},</p>
     <p>Use the code below to set a new password. It expires in two hours.</p>
     <p style="background:#F7F8FC;border-radius:12px;padding:16px;font-family:monospace;font-size:16px;letter-spacing:2px">${input.token}</p>
     ${button(`${env.publicUrl}/forgot-password?token=${input.token}`, "Set a new password")}
     <p>If you did not ask for this, you can safely ignore this email.</p>`
  );

export const welcomeResidentEmail = (input: { name: string; pgName: string; roomNumber: string; bedLabel: string; password?: string }) =>
  shell(
    `Welcome to ${input.pgName}`,
    `<p>Hi ${input.name},</p>
     <p>Your account is ready and you have been allocated <strong>Room ${input.roomNumber}, Bed ${input.bedLabel}</strong>.</p>
     ${input.password ? `<p>Sign in with <strong>${input.name}</strong>'s email and this temporary password: <strong style="font-family:monospace">${input.password}</strong>. Change it from your profile after signing in.</p>` : ""}
     ${button(`${env.publicUrl}/login`, "Open PG Manager")}`
  );

export const rentReminderEmail = (input: { name: string; pgName: string; month: string; balance: string }) =>
  shell(
    `Rent reminder for ${input.month}`,
    `<p>Hi ${input.name},</p>
     <p><strong>${input.balance}</strong> is pending for ${input.month} at <strong>${input.pgName}</strong>.</p>
     <p>You can see your receipts and payment history in the app. Payments are confirmed by your PG owner.</p>
     ${button(`${env.publicUrl}/resident/rent`, "View rent details")}`
  );

export const complaintUpdateEmail = (input: { name: string; title: string; status: string; message?: string }) =>
  shell(
    `Update on your complaint`,
    `<p>Hi ${input.name},</p>
     <p>Your complaint <strong>${input.title}</strong> is now <strong>${input.status}</strong>.</p>
     ${input.message ? `<p style="background:#F7F8FC;border-radius:12px;padding:14px 16px">${input.message}</p>` : ""}
     ${button(`${env.publicUrl}/resident/complaints`, "Track your complaint")}`
  );

export const teamAlertEmail = (input: { heading: string; lines: string[]; link?: string }) =>
  shell(
    input.heading,
    `<ul style="padding-left:18px;margin:0">${input.lines.map((line) => `<li style="margin-bottom:6px">${line}</li>`).join("")}</ul>
     ${input.link ? button(input.link, "Open in PG Manager") : ""}`,
    "Internal notification from PG Manager."
  );
