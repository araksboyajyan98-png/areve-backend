import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import { logger } from "../config/logger";

/*
 * Сериализаторы заданы явно и урезаны.
 * Стандартный req у pino-http пишет все заголовки, включая cookie и
 * authorization, а на этом сервере в каждом запросе к /api/leads лежат имя и
 * телефон родителя. Тело pino-http не логирует никогда — но заголовки лучше
 * тоже не тащить: пользы от них здесь нет.
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = req.headers["x-request-id"];
    const id = (Array.isArray(existing) ? existing[0] : existing) || randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});
