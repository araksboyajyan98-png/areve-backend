import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "./logger";

/*
 * Отправка почты через SMTP. Что именно отправлять — решает модуль:
 * shared не знает ни про заявки, ни про предметную область.
 *
 * Почта настраивается только окружением. Если настроек нет, отправка молча
 * выключена: сайт продолжает принимать заявки, они сохраняются в базу,
 * не уходит лишь уведомление. Так разработка и первый запуск не требуют
 * почтового ящика.
 */

const host = process.env.SMTP_HOST;
const user = process.env.SMTP_USER;
const password = process.env.SMTP_PASSWORD;
const port = Number(process.env.SMTP_PORT) || 587;

/** Настроена ли отправка почты. */
export const isMailerConfigured = Boolean(host && user && password);

let transporter: Transporter | null = null;

if (isMailerConfigured) {
  transporter = nodemailer.createTransport({
    host,
    port,
    // 465 — TLS с самого начала, 587 — обычный порт с переходом на TLS
    secure: port === 465,
    auth: { user: user as string, pass: password as string },
  });
  logger.info({ host, port }, "Mailer configured");
} else {
  logger.warn(
    "Mailer is not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD): notifications will be skipped"
  );
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Отправляет письмо. Бросает, если отправка не удалась — вызывающий решает,
 * насколько это важно. Если почта не настроена, тихо ничего не делает.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (!transporter) return;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || (user as string),
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}
