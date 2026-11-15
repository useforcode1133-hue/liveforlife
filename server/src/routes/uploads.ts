import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { ah, AppError, parse } from "../lib/http";
import { authenticate } from "../lib/auth";
import { env } from "../lib/env";

const router = Router();

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

router.post(
  "/image",
  authenticate,
  ah(async (req, res) => {
    const data = parse(
      z.object({
        dataUrl: z.string().min(20, "Choose an image to upload."),
        folder: z.enum(["pg", "rooms", "complaints", "avatars", "menu"]).default("pg"),
      }),
      req.body
    );

    const match = /^data:([\w/+.-]+);base64,(.+)$/.exec(data.dataUrl);
    if (!match) throw new AppError(422, "That file is not a supported image.");
    const mime = match[1] ?? "";
    const base64 = match[2] ?? "";
    if (!ALLOWED.includes(mime)) throw new AppError(422, "Upload a PNG, JPG, WEBP or GIF image.");
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength > 5 * 1024 * 1024) throw new AppError(422, "Images must be smaller than 5 MB.");

    const ext = (mime.split("/")[1] ?? "png").replace("jpeg", "jpg");
    const dir = path.join(process.cwd(), env.uploadsDir, data.folder);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
    fs.writeFileSync(path.join(dir, filename), buffer);

    res.status(201).json({ url: `/uploads/${data.folder}/${filename}` });
  })
);

export default router;
