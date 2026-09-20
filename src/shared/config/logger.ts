import pino from "pino";
import { AppError } from "../errors/AppError";

const isDev = process.env.NODE_ENV === "development";

/*
 * Ошибка разбора тела запроса содержит его фрагмент.
 *
 * Когда JSON битый, движок вставляет в текст ошибки первые байты тела —
 * а в теле лежат имя и телефон родителя. Правило проекта не допускает их
 * в логах ни в одном месте, поэтому такие ошибки записываются без текста
 * и без стека: для разбора достаточно знать, что тело не разобралось.
 *
 * body-parser помечает их полем `type` вида entity.*; у обычных ошибок
 * такого поля нет.
 */
const isBodyParseError = (err: Error): boolean => {
  const candidate = err as Error & { type?: unknown; body?: unknown };
  return typeof candidate.type === "string" && candidate.type.startsWith("entity.");
};

/** Цепочка cause обрезается до типа и сообщения: там бывают тексты SQL с аргументами. */
export const errorSerializer = (err: unknown) => {
  if (!(err instanceof Error)) return err;

  if (isBodyParseError(err)) {
    const { type, status, statusCode } = err as Error & {
      type?: string;
      status?: number;
      statusCode?: number;
    };
    return { type: err.name, reason: type, status: status ?? statusCode };
  }

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
