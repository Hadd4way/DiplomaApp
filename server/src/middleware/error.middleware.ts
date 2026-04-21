import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export const errorMiddleware = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (env.IS_DEVELOPMENT) {
    console.error("[error]", error);
  } else {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error(`[error] ${message}`);
  }

  res.status(500).json({
    ok: false,
    error: "Internal server error"
  });
};
