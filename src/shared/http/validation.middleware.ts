import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { AppError, ErrorCode } from "../errors/AppError";

export const handleValidationErrors = (req: Request, _res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  // value не отдаётся: express-validator кладёт туда введённое значение,
  // а здесь это имя и телефон родителя
  const details = errors.array().map((e) => ({
    field: "path" in e ? e.path : undefined,
    message: e.msg,
  }));

  next(AppError.badRequest(ErrorCode.VALIDATION_FAILED, "Check the form fields", details));
};
