import { Request, Response, NextFunction, RequestHandler } from "express";

/** Контроллер выбрасывает AppError и не думает про res.status. */
export const asyncHandler =
  <T extends RequestHandler>(handler: T): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
