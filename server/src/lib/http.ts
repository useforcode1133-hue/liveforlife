import { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, ZodTypeAny, z } from "zod";

export class AppError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wrap async route handlers so rejected promises reach the error middleware. */
export const ah = (fn: AsyncHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(422, "Please check the highlighted fields.", flattenZod(result.error));
  }
  return result.data;
}

function flattenZod(error: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "That resource does not exist." });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, fields: err.details });
  }
  if (err instanceof ZodError) {
    return res.status(422).json({ error: "Invalid request", fields: flattenZod(err) });
  }
  const anyErr = err as { code?: string; message?: string };
  if (anyErr?.code === "P2002") {
    return res.status(409).json({ error: "That record already exists." });
  }
  if (anyErr?.code === "P2025") {
    return res.status(404).json({ error: "That record no longer exists." });
  }
  console.error("[api] unhandled error", err);
  return res.status(500).json({ error: "Something went wrong on our side. Please try again." });
}
