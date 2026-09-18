# 02. Бэкенд

REST API на **Express 5 + TypeScript (CommonJS)** поверх **PostgreSQL через Prisma 5**.
Архитектура — **модульный монолит**: одна служба, но модули устроены как будущие
сервисы — любой можно выделить в отдельный процесс, не переписывая потребителей.

Точка входа: `src/server.ts` → `src/app/app.ts` → роутеры модулей.

## 1. Дерево

```
backend/
  tsconfig.json  eslint.config.mjs  .env.example
  prisma/schema.prisma  prisma/migrations/
  tools/check-architecture.cjs  проверка архитектуры (05-arch-checks.md)
  src/
    server.ts       вход: проверка env, запуск HTTP
    app/app.ts      сборка Express: middleware и роутеры модулей
    modules/        предметные области
      <name>/
    shared/         общее, не знающее о предметных областях
      config/       logger, prisma
      errors/       AppError, коды ошибок
      http/         asyncHandler, errorHandler, requestLogger,
                    handleValidationErrors, param
      lib/          чистые помощники
      types/        расширение типов Express
    scripts/        разовые скрипты обслуживания
```

## 2. Устройство модуля

| Файл | Что кладём |
|---|---|
| `<name>.routes.ts` | маршруты, подключение валидаторов |
| `<name>.controller.ts` | разбор запроса, HTTP-статус, ответ |
| `<name>.service.ts` | предметная логика и запросы Prisma |
| `<name>.validation.ts` | валидаторы express-validator |
| `index.ts` | публичный API модуля |

Контроллеры не обращаются к Prisma, сервисы не знают про `req`/`res`.
Контроллер выбрасывает `AppError`, а не пишет `res.status(4xx)`.

## 3. Правила зависимостей

Проверяются `npm run check:arch`.

- **`shared` не знает ни о модулях, ни о приложении.**
- **В чужой модуль — только через его `index.ts`.** Экспорт добавляется, когда
  понадобился, а не впрок.
- **Внутри своего модуля — относительные пути к своим файлам**, не через свой `index.ts`.
- **Модули не образуют кругов.** Общая часть двух модулей переезжает в модуль,
  от которого зависят оба.
- **`app/` и `server.ts` берут у модулей только публичный API**; их самих никто не импортирует.
- **Модуль не читает чужие таблицы напрямую** — только через сервис модуля-владельца.
- **Импорты — относительными путями.** Псевдоним `@/` `tsc` при сборке не переписывает.

## 4. Пример модуля

```ts
// src/modules/items/items.validation.ts
import { body } from "express-validator";

export const validateCreateItem = [
  body("title").isString().trim().isLength({ min: 1, max: 200 }),
];
```

```ts
// src/modules/items/items.service.ts
import prisma from "../../shared/config/prisma";
import { AppError } from "../../shared/errors/AppError";

export const listItems = () =>
  prisma.item.findMany({ orderBy: { updatedAt: "desc" }, take: 50 });

export async function getItem(id: string) {
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) throw AppError.notFound("Item not found");
  return item;
}

export const createItem = (data: { title: string }) => prisma.item.create({ data });
```

```ts
// src/modules/items/items.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { param } from "../../shared/http/routeParam";
import * as itemsService from "./items.service";

/** GET /api/items */
export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ items: await itemsService.listItems() });
});

/** GET /api/items/:id */
export const getOne = asyncHandler(async (req: Request, res: Response) => {
  res.json(await itemsService.getItem(param(req, "id")));
});

/** POST /api/items — поля проверены валидатором в цепочке маршрута */
export const create = asyncHandler(async (req: Request, res: Response) => {
  res.status(201).json(await itemsService.createItem({ title: req.body.title }));
});
```

```ts
// src/modules/items/items.routes.ts
import { Router } from "express";
import { handleValidationErrors } from "../../shared/http/validation.middleware";
import { validateCreateItem } from "./items.validation";
import { list, getOne, create } from "./items.controller";

const router = Router();

router.get("/", list);
router.post("/", validateCreateItem, handleValidationErrors, create);
router.get("/:id", getOne); // статичные пути объявлять ДО /:id

export default router;
```

```ts
// src/modules/items/index.ts
export { default as itemsRoutes } from "./items.routes";
```

## 5. Точка входа

```ts
// src/server.ts
import "dotenv/config";
import app from "./app/app";
import { logger } from "./shared/config/logger";

const REQUIRED_ENV_VARS = ["DATABASE_URL"];

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  // console, а не logger: в dev pino пишет асинхронно, и при немедленном exit
  // сообщение не успевает попасть в вывод
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 5001;

app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || "development" }, "Server started");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});
```

## 6. Сборка приложения

Порядок middleware строгий.

```ts
// src/app/app.ts
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";

import { itemsRoutes } from "../modules/items";
import { requestLogger } from "../shared/http/requestLogger";
import { errorHandler, notFoundHandler } from "../shared/http/errorHandler";

const app: Application = express();

// 0. логирование с request-id — первым, чтобы в лог попали и отказы CORS
app.use(requestLogger);

// 1. заголовки безопасности
app.use(helmet());

// 2. CORS — до маршрутов
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // curl, server-to-server
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    exposedHeaders: ["X-Request-Id"],
  })
);

// 3. парсеры
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// 4. маршруты модулей
app.use("/api/items", itemsRoutes);

// 5. 404 и 6. единый обработчик ошибок
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
```

## 7. Ошибки

Все ошибки приходят одним конвертом:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Check the form fields", "details": [] } }
```

`code` — машинный идентификатор, по нему фронтенд подставляет перевод.
`details` есть только у валидации и не содержит введённых значений.

```ts
// src/shared/errors/AppError.ts
export const ErrorCode = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Ошибка, которую безопасно показать. Всё остальное — INTERNAL без подробностей. */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCodeValue;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCodeValue, message: string, options?: { details?: unknown; cause?: unknown }) {
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
}
```

Новый код заводится, когда пользователь должен действовать иначе; каждый код
получает перевод в разделе `errors` фронтенда.

```ts
// src/shared/http/asyncHandler.ts
import { Request, Response, NextFunction, RequestHandler } from "express";

/** Контроллер выбрасывает AppError и не думает про res.status. */
export const asyncHandler =
  <T extends RequestHandler>(handler: T): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
```

```ts
// src/shared/http/errorHandler.ts
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
```

```ts
// src/shared/http/validation.middleware.ts
import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { AppError, ErrorCode } from "../errors/AppError";

export const handleValidationErrors = (req: Request, _res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  // value не отдаётся: express-validator кладёт туда введённое значение
  const details = errors.array().map((e) => ({
    field: "path" in e ? e.path : undefined,
    message: e.msg,
  }));

  next(AppError.badRequest(ErrorCode.VALIDATION_FAILED, "Check the form fields", details));
};
```

```ts
// src/shared/http/routeParam.ts
import type { Request } from "express";
import { AppError, ErrorCode } from "../errors/AppError";

/** Express 5 типизирует params как string | string[]; отсутствующий параметр — опечатка в имени. */
export const param = (req: Request, name: string): string => {
  const value = req.params[name];
  const result = Array.isArray(value) ? value[0] : value;
  if (typeof result !== "string" || result.length === 0) {
    throw AppError.badRequest(ErrorCode.VALIDATION_FAILED, `Missing route parameter: ${name}`);
  }
  return result;
};
```

## 8. Логирование

`pino` вместо `console`. У каждого запроса идентификатор: из `X-Request-Id`, если
пришёл от прокси, иначе генерируется; возвращается в ответе.

```ts
// src/shared/config/logger.ts
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
```

```ts
// src/shared/http/requestLogger.ts
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import { logger } from "../config/logger";

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers["x-request-id"];
    const id = (Array.isArray(existing) ? existing[0] : existing) || randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});
```

```ts
// src/shared/types/express.d.ts
import "express";

declare module "express-serve-static-core" {
  interface Request {
    /** Идентификатор запроса, проставляется requestLogger. */
    id: string;
  }
}
```

## 9. Prisma

```ts
// src/shared/config/prisma.ts
import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const isDev = process.env.NODE_ENV === "development";

const prisma = new PrismaClient({
  log: isDev
    ? [
        { emit: "event", level: "query" },
        { emit: "event", level: "warn" },
        { emit: "event", level: "error" },
      ]
    : [{ emit: "event", level: "error" }],
});

prisma.$on("error", (e) => logger.error({ prisma: e }, "Prisma error"));
if (isDev) {
  prisma.$on("warn", (e) => logger.warn({ prisma: e }, "Prisma warning"));
  prisma.$on("query", (e) => logger.debug({ duration: e.duration, query: e.query }, "SQL"));
}

export default prisma;
```

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Item {
  id        String   @id @default(uuid())
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([updatedAt])
}
```

- Индекс под каждый частый запрос списка.
- Переименование модели Prisma генерирует `DROP TABLE` + `CREATE TABLE` — такую
  миграцию пишут вручную через `ALTER TABLE … RENAME`.
- `migrate dev` — только локально.
