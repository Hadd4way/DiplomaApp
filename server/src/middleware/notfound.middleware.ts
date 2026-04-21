import { NextFunction, Request, Response } from "express";

export const notFoundMiddleware = (
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  res.status(404).json({
    ok: false,
    message: "Route not found"
  });
};
