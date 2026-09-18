import { Request, Response, NextFunction } from "express";
import { AppError, ErrorCode } from "../errors/AppError";
import { logger } from "../config/logger";

export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn({ method: req.method, path: req.path, requestId: req.id }, "Route not found");
  res.status(404).json({ error: { code: ErrorCode.NOT_FOUND, message: "Resource not found" } });
};

/** Статус у ошибок сторонних middleware: битый JSON — 400, большое тело — 413. */
const externalStatus = (err: unknown): number | undefined => {
  if (typeof err !== "object" || err === null) return undefined;
  const c = err as { status?: unknown; statusCode?: unknown };
  const value = c.status ?? c.statusCode;
  return typeof value === "number" && value >= 400 && value < 600 ? value : undefined;
};

export const errorHandler = (err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    logger.error({ err, requestId: req.id }, "Error after response was sent");
    return next(err);
  }

  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err, requestId: req.id }, err.message);
    else logger.warn({ code: err.code, status: err.status, requestId: req.id }, err.message);

    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    });
  }

  const status = externalStatus(err);
  if (status && status < 500) {
    // Оригинальный текст — только в лог: сообщение о битом JSON содержит фрагмент тела запроса.
    logger.warn({ err, status, requestId: req.id }, "Bad request");
    return res.status(status).json({
      error: {
        code: ErrorCode.VALIDATION_FAILED,
        message: status === 413 ? "Request too large" : "Bad request",
      },
    });
  }

  // неожиданное наружу не раскрываем: в тексте могут быть параметры запроса к БД
  logger.error({ err, requestId: req.id }, "Unhandled error");
  res.status(500).json({
    error: {
      code: ErrorCode.INTERNAL,
      message: "Internal server error",
      ...(process.env.NODE_ENV === "development" && {
        details: err instanceof Error ? err.stack : String(err),
      }),
    },
  });
};
