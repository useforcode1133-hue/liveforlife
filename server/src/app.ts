import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";
import { env } from "./lib/env";
import { errorHandler, notFoundHandler } from "./lib/http";
import authRoutes from "./routes/auth";
import uploadRoutes from "./routes/uploads";
import adminRoutes from "./routes/admin";
import ownerPgRoutes from "./routes/ownerPg";
import ownerResidentRoutes from "./routes/ownerResidents";
import ownerRentRoutes from "./routes/ownerRent";
import menuRoutes from "./routes/menus";
import complaintRoutes from "./routes/complaints";
import announcementRoutes from "./routes/announcements";
import notificationRoutes from "./routes/notifications";
import residentRoutes from "./routes/resident";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: "8mb" }));
  app.use("/uploads", express.static(path.join(process.cwd(), env.uploadsDir)));

  app.get("/api/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

  app.use("/api/auth", authRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/owner", ownerPgRoutes, ownerResidentRoutes, ownerRentRoutes);
  app.use("/api", menuRoutes);
  app.use("/api", complaintRoutes);
  app.use("/api", announcementRoutes);
  app.use("/api", notificationRoutes);
  app.use("/api/resident", residentRoutes);

  // In production the built React app is served by this same process, so a
  // single container/host can run the whole product.
  const clientDist = path.join(__dirname, "../../client/dist");
  if (fs.existsSync(path.join(clientDist, "index.html"))) {
    app.use(express.static(clientDist, { index: false, maxAge: "1h" }));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return next();
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
