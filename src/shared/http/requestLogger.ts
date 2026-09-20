import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import { errorSerializer, logger } from "../config/logger";

/** Идентификатор от прокси: буквы, цифры и разделители, не длиннее 64 знаков. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

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
    const given = Array.isArray(existing) ? existing[0] : existing;

    /*
     * Чужой идентификатор берётся, только если он похож на идентификатор.
     * Раньше заголовок принимался как есть — а по нему потом разбирают
     * происшествия: любой мог подделать чужой id, склеить свои запросы
     * с чужими или раздуть лог строкой на сотни символов.
     */
    const id = given && SAFE_REQUEST_ID.test(given) ? given : randomUUID();

    res.setHeader("X-Request-Id", id);
    return id;
  },
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
    // Тот же, что у логгера: без него ошибка разбора тела попала бы сюда целиком.
    err: errorSerializer,
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});
