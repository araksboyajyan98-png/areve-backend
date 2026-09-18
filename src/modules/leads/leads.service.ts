import prisma from "../../shared/config/prisma";
import { AppError, ErrorCode } from "../../shared/errors/AppError";
import { normalizePhone } from "../../shared/lib/normalizePhone";
import { notifyNewLead } from "./leads.notification";

export interface CreateLeadInput {
  name: string;
  phone: string;
  message?: string;
}

/**
 * Сохраняет заявку. Телефон приводится к одному виду здесь, а не в контроллере
 * и не в базе: это предметное правило, и оно должно действовать при любом
 * способе создания заявки.
 */
export async function createLead(input: CreateLeadInput): Promise<{ id: string }> {
  const phone = normalizePhone(input.phone);

  // Валидатор маршрута это уже проверил. Сюда попадёт только вызов в обход
  // маршрута — например, из будущего скрипта.
  if (!phone) {
    throw AppError.badRequest(ErrorCode.VALIDATION_FAILED, "Check the form fields", [
      { field: "phone", message: "phone" },
    ]);
  }

  const message = input.message?.trim() || null;

  const lead = await prisma.lead.create({
    data: { name: input.name, phone, message },
    // наружу уходит только идентификатор: возвращать телефон обратно незачем
    select: { id: true },
  });

  /*
   * Уведомление намеренно без await: заявка уже в базе, и ответ родителю
   * не должен ждать почтовый сервер — тем более падать вместе с ним.
   */
  notifyNewLead({ id: lead.id, name: input.name, phone, message });

  return lead;
}
