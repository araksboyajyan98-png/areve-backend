export const ErrorCode = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Ошибка, которую безопасно показать. Всё остальное — INTERNAL без подробностей. */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCodeValue;
  readonly details?: unknown;

  constructor(
    status: number,
    code: ErrorCodeValue,
    message: string,
    options?: { details?: unknown; cause?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = options?.details;
  }

  static badRequest(code: ErrorCodeValue, message: string, details?: unknown) {
    return new AppError(400, code, message, { details });
  }
  static notFound(message = "Not found") {
    return new AppError(404, ErrorCode.NOT_FOUND, message);
  }
  static conflict(message: string) {
    return new AppError(409, ErrorCode.CONFLICT, message);
  }
  static forbidden(message: string) {
    return new AppError(403, ErrorCode.FORBIDDEN, message);
  }
  static tooManyRequests(message = "Too many requests") {
    return new AppError(429, ErrorCode.RATE_LIMITED, message);
  }
}
