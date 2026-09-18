import "express";

declare module "express-serve-static-core" {
  interface Request {
    /** Идентификатор запроса, проставляется requestLogger. */
    id: string;
  }
}
