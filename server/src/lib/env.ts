import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "pg-management-development-secret",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  isProduction: process.env.NODE_ENV === "production",
  uploadsDir: process.env.UPLOADS_DIR ?? "uploads",
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:3000",
  mail: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.MAIL_FROM ?? "PG Manager <no-reply@pgmanager.app>",
    teamInbox: process.env.TEAM_INBOX ?? "",
  },
};

export const SESSION_DAYS = 7;
