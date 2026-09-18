import pino from "pino";
import { AppError } from "../errors/AppError";

const isDev = process.env.NODE_ENV === "development";

/** Цепочка cause обрезается до типа и сообщения: там бывают тексты SQL с аргументами. */
const errorSerializer = (err: unknown) => {
  if (!(err instanceof Error)) return err;

  const causes: string[] = [];
  let current: unknown = (err as Error & { cause?: unknown }).cause;
  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    causes.push(`${current.name}: ${current.message}`);
    current = (current as Error & { cause?: unknown }).cause;
  }

  const extra: Record<string, unknown> = {};
  for (const key of ["code", "meta", "status"]) {
    const value = (err as unknown as Record<string, unknown>)[key];
    if (value !== undefined) extra[key] = value;
  }

  return {
    type: err.name,
    message: err.message,
    stack: err.stack,
    ...extra,
    ...(err instanceof AppError && { code: err.code, status: err.status }),
    ...(causes.length > 0 && { causes }),
  };
};

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  serializers: { err: errorSerializer, error: errorSerializer },
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
    },
  }),
});
