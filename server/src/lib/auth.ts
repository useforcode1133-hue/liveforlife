import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env, SESSION_DAYS } from "./env";
import { prisma } from "./prisma";
import { AppError } from "./http";

export type Role = "SUPER_ADMIN" | "PG_OWNER" | "RESIDENT";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    expiresIn: `${SESSION_DAYS}d`,
  });
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new AppError(401, "Please sign in to continue.");
    const token = header.slice(7);
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    } catch {
      throw new AppError(401, "Your session has expired. Please sign in again.");
    }
    const user = await prisma.user.findUnique({
      where: { id: String(payload.sub) },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    if (!user) throw new AppError(401, "This account is no longer available.");
    if (user.status === "SUSPENDED") throw new AppError(403, "This account is suspended.");
    if (user.status === "REJECTED") throw new AppError(403, "This account was not approved.");
    req.user = user as AuthUser;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "Please sign in to continue."));
    if (!roles.includes(req.user.role)) return next(new AppError(403, "You do not have access to this area."));
    if (req.user.role === "PG_OWNER" && req.user.status !== "ACTIVE") {
      return next(new AppError(403, "Your owner account is awaiting approval."));
    }
    next();
  };

/** Guard used only for the "owner approval pending" screen. */
export const requireOwner = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, "Please sign in to continue."));
  if (req.user.role !== "PG_OWNER") return next(new AppError(403, "Owner access only."));
  next();
};
