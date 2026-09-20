import { body } from "express-validator";
import { isValidPhone } from "../../shared/lib/normalizePhone";

/*
 * На каждое поле — не больше одной записи в details, и текст всегда один и тот
 * же: это ключ, по которому фронтенд достаёт перевод.
 *
 * Отсюда .bail() после первой проверки: без него упавший isString дал бы
 * стандартное "Invalid value", а следом isLength добавил бы вторую запись про
 * то же поле. И .withMessage() нужен у каждой проверки — он относится только
 * к предыдущей, а не ко всей цепочке.
 *
 * Поля-ловушки здесь нет намеренно: её проверяет catchHoneypot до валидации.
 * Валидатор на неё отвечал бы отказом с именем поля — то есть выдавал бы
 * боту, что ловушка существует.
 */
export const validateCreateLead = [
  body("name")
    .isString()
    .withMessage("name")
    .bail()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("name"),

  /*
   * Предел длины обязателен: isValidPhone выбрасывает всё, кроме цифр, поэтому
   * без него строка на мегабайт с восемью цифрами внутри считалась бы
   * телефоном, и разбор гонял бы по ней на каждом запросе.
   */
  body("phone")
    .isString()
    .withMessage("phone")
    .bail()
    .trim()
    .isLength({ max: 32 })
    .withMessage("phone")
    .bail()
    .custom(isValidPhone)
    .withMessage("phone"),

  /*
   * optional({ values: "falsy" }): пустая строка из textarea — это «поле не
   * заполнили», а не ошибка. Иначе форма без сообщения не прошла бы.
   */
  body("message")
    .optional({ values: "falsy" })
    .isString()
    .withMessage("message")
    .bail()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("message"),
];
