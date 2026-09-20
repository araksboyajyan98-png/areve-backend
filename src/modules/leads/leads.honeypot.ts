import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { logger } from "../../shared/config/logger";

/** Имя скрытого поля-ловушки. Должно совпадать с тем, что рисует фронтенд. */
export const HONEYPOT_FIELD = "website";

/**
 * Ловушка для ботов. Поле скрыто стилями, человек его не видит и не заполняет.
 *
 * Стоит **до валидации** намеренно. Раньше проверка была в контроллере, после
 * валидатора, и это выдавало ловушку двумя способами: бот с заполненным полем
 * и кривым телефоном получал подробный отказ вместо правдоподобного успеха,
 * а отправив в поле не строку — получал ответ с его именем, то есть прямое
 * подтверждение, что поле известно серверу и проверяется.
 *
 * Ответ такой же, как при успехе, и с правдоподобным идентификатором: отказ
 * подсказал бы боту, что он опознан, и его переписали бы. Запись не создаётся.
 */
export const catchHoneypot = (req: Request, res: Response, next: NextFunction) => {
  const value = req.body?.[HONEYPOT_FIELD];
  const filled = typeof value === "string" ? value.trim() !== "" : value !== undefined;

  if (!filled) return next();

  logger.warn({ requestId: req.id }, "Honeypot field filled, lead discarded");
  res.status(201).json({ id: randomUUID() });
};
