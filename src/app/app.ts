import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";

import { leadsRoutes } from "../modules/leads";
import { requestLogger } from "../shared/http/requestLogger";
import { errorHandler, notFoundHandler } from "../shared/http/errorHandler";

const app: Application = express();

/*
 * За обратным прокси req.ip должен браться из X-Forwarded-For, иначе все
 * заявки придут с адреса прокси и ограничение частоты отсечёт живых родителей.
 * Доверять заголовку без прокси нельзя — его подделает кто угодно, поэтому
 * по умолчанию не доверяем никому.
 */
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy) {
  app.set("trust proxy", Number.isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy));
}

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

// 4. маршруты
// Проверка живости для хостинга и мониторинга: предметной логики нет,
// поэтому и модуля под неё нет.
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use("/api/leads", leadsRoutes);

// 5. 404 и 6. единый обработчик ошибок
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
