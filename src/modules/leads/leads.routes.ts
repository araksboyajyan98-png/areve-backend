import { Router } from "express";
import { handleValidationErrors } from "../../shared/http/validation.middleware";
import { rateLimit } from "../../shared/http/rateLimit";
import { validateCreateLead } from "./leads.validation";
import { create } from "./leads.controller";

const MINUTE = 60 * 1000;

const windowMinutes = Number(process.env.LEADS_RATE_LIMIT_WINDOW_MINUTES) || 60;
const max = Number(process.env.LEADS_RATE_LIMIT_MAX) || 10;

/*
 * Ограничение стоит перед валидацией: поток мусора не должен доходить
 * до разбора тела и тем более до базы.
 */
const limiter = rateLimit({ windowMs: windowMinutes * MINUTE, max });

const router = Router();

router.post("/", limiter, validateCreateLead, handleValidationErrors, create);

export default router;
