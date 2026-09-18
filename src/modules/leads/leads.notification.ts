import { sendMail, isMailerConfigured } from "../../shared/config/mailer";
import { logger } from "../../shared/config/logger";

export interface LeadNotification {
  id: string;
  name: string;
  /** Уже приведённый к +374XXXXXXXX. */
  phone: string;
  message?: string | null;
}

const recipient = process.env.LEADS_NOTIFY_TO;

const compose = (lead: LeadNotification) => ({
  subject: `Նոր հայտ կայքից՝ ${lead.name}`,
  text: [
    `Անուն: ${lead.name}`,
    `Հեռախոս: ${lead.phone}`,
    "",
    lead.message ? `Հաղորդագրություն:\n${lead.message}` : "Հաղորդագրություն չկա։",
    "",
    `ID: ${lead.id}`,
  ].join("\n"),
});

/**
 * Сообщает о новой заявке. **Не ждать результата и не пробрасывать ошибку:**
 * заявка уже сохранена, и ответ родителю не должен зависеть от того, дошло ли
 * письмо. Упавшая отправка — запись в лог, а не отказ формы.
 *
 * Имя и телефон есть в письме — за этим его и шлют, — но в лог не попадают.
 */
export function notifyNewLead(lead: LeadNotification): void {
  if (!isMailerConfigured || !recipient) {
    logger.warn({ leadId: lead.id }, "Lead notification skipped: mailer or recipient not set");
    return;
  }

  const { subject, text } = compose(lead);

  void sendMail({ to: recipient, subject, text })
    .then(() => logger.info({ leadId: lead.id }, "Lead notification sent"))
    .catch((err) => logger.error({ err, leadId: lead.id }, "Lead notification failed"));
}
