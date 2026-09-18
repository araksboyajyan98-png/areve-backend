import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { logger } from "../../shared/config/logger";
import { HONEYPOT_FIELD } from "./leads.validation";
import * as leadsService from "./leads.service";

/** POST /api/leads — поля проверены валидатором в цепочке маршрута */
export const create = asyncHandler(async (req: Request, res: Response) => {
  /*
   * Ловушка для ботов: поле скрыто стилями, человек его не видит и не заполняет.
   * Отвечаем как при успехе и с правдоподобным идентификатором — отказ или
   * пустой ответ подсказали бы боту, что он опознан, и его переписали бы.
   * Запись при этом не создаётся.
   */
  const honeypot = req.body[HONEYPOT_FIELD];
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    logger.warn({ requestId: req.id }, "Honeypot field filled, lead discarded");
    res.status(201).json({ id: randomUUID() });
    return;
  }

  const lead = await leadsService.createLead({
    name: req.body.name,
    phone: req.body.phone,
    message: req.body.message,
  });

  // В лог — только факт и идентификатор. Имя и телефон в логи не попадают.
  logger.info({ requestId: req.id, leadId: lead.id }, "Lead created");

  res.status(201).json({ id: lead.id });
});
