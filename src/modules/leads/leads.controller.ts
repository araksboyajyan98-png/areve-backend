import { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { logger } from "../../shared/config/logger";
import * as leadsService from "./leads.service";

/** POST /api/leads — ловушка отсеяна, поля проверены в цепочке маршрута */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const lead = await leadsService.createLead({
    name: req.body.name,
    phone: req.body.phone,
    message: req.body.message,
  });

  // В лог — только факт и идентификатор. Имя и телефон в логи не попадают.
  logger.info({ requestId: req.id, leadId: lead.id }, "Lead created");

  res.status(201).json({ id: lead.id });
});
