import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

const isDev = process.env.NODE_ENV === "development";

const prisma = new PrismaClient({
  log: isDev
    ? [
        { emit: "event", level: "query" },
        { emit: "event", level: "warn" },
        { emit: "event", level: "error" },
      ]
    : [{ emit: "event", level: "error" }],
});

prisma.$on("error", (e) => logger.error({ prisma: e }, "Prisma error"));
if (isDev) {
  prisma.$on("warn", (e) => logger.warn({ prisma: e }, "Prisma warning"));
  /*
   * e.params не логируем: в параметрах INSERT в Lead лежат имя и телефон
   * родителя. Достаточно текста запроса и длительности.
   */
  prisma.$on("query", (e) => logger.debug({ duration: e.duration, query: e.query }, "SQL"));
}

export default prisma;
