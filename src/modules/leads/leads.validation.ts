import { body } from "express-validator";
import { isValidPhone } from "../../shared/lib/normalizePhone";

/** Имя скрытого поля-ловушки. Должно совпадать с тем, что рисует фронтенд. */
export const HONEYPOT_FIELD = "website";

/*
 * На каждое поле — не больше одной записи в details, и текст всегда один и тот
 * же: это ключ, по которому фронтенд достаёт перевод.
 *
 * Отсюда .bail() после первой проверки: без него упавший isString дал бы
 * стандартное "Invalid value", а следом isLength добавил бы вторую запись про
 * то же поле. И .withMessage() нужен у каждой проверки — он относится только
 * к предыдущей, а не ко всей цепочке.
 */
export const validateCreateLead = [
  body("name")
    .isString()
    .withMessage("name")
    .bail()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("name"),

  body("phone")
    .isString()
    .withMessage("phone")
    .bail()
    .trim()
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

  // Ловушку проверяет контроллер, здесь только следим за типом.
  body(HONEYPOT_FIELD).optional().isString().withMessage(HONEYPOT_FIELD),
];
