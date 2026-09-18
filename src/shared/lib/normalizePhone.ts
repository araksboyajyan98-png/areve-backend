/*
 * Армянский мобильный номер: код страны 374, затем двузначный код оператора
 * и шесть цифр — всего 8 цифр после 374.
 *
 * Родители пишут его как придётся: «+374 77 123 456», «+37477123456»,
 * «077 123456», «0-77-12-34-56». Без приведения к одному виду в списке заявок
 * один и тот же человек выглядел бы как несколько разных.
 */

const NATIONAL_DIGITS = 8;
const COUNTRY_CODE = "374";

/** Выделяет 8 цифр национального номера из любой записи. */
function toNational(digits: string): string | null {
  // +374 77 123 456
  if (digits.startsWith(COUNTRY_CODE) && digits.length === COUNTRY_CODE.length + NATIONAL_DIGITS) {
    return digits.slice(COUNTRY_CODE.length);
  }
  // 077 123456 — ведущий ноль вместо кода страны
  if (digits.startsWith("0") && digits.length === 1 + NATIONAL_DIGITS) {
    return digits.slice(1);
  }
  // 77 123456 — записан без кода страны и без ведущего нуля
  if (digits.length === NATIONAL_DIGITS) {
    return digits;
  }
  return null;
}

/**
 * Приводит номер к виду `+374XXXXXXXX`.
 * Возвращает `null`, если это не похоже на армянский номер —
 * тогда вызывающий решает, ошибка это валидации или что-то ещё.
 */
export function normalizePhone(raw: string): string | null {
  const national = toNational(raw.replace(/\D/g, ""));

  /*
   * Код оператора не начинается с нуля. Без этой проверки номер на цифру
   * короче («095 313 63» → 8 цифр) попадал бы в ветку «без кода страны»
   * и превращался в +37409531363 — заявку с несуществующим телефоном,
   * по которой некому перезвонить.
   */
  if (!national || national.startsWith("0")) return null;

  return `+${COUNTRY_CODE}${national}`;
}

/** Годится ли строка как номер телефона. Для валидатора, чтобы не дублировать разбор. */
export const isValidPhone = (raw: string): boolean => normalizePhone(raw) !== null;
