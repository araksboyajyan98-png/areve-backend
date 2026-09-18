import "dotenv/config";
import app from "./app/app";
import prisma from "./shared/config/prisma";
import { logger } from "./shared/config/logger";

const REQUIRED_ENV_VARS = ["DATABASE_URL"];

const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  // console, а не logger: в dev pino пишет асинхронно, и при немедленном exit
  // сообщение не успевает попасть в вывод
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 5001;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || "development" }, "Server started");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});

/*
 * Остановка по порядку: сначала перестаём принимать запросы и даём
 * доработать начатым, потом отпускаем соединение с базой. В обратном порядке
 * запрос, который уже разбирается, упал бы на закрытом клиенте Prisma.
 */
const shutdown = (signal: string) => {
  logger.info({ signal }, "Shutting down");
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
