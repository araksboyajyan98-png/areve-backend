import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ErrorCode } = require("../dist/shared/errors/AppError.js");
const { HONEYPOT_FIELD } = require("../dist/modules/leads/leads.honeypot.js");

/*
 * Договор с фронтендом. Репозитории разные, компилятор их не связывает,
 * поэтому ожидания записаны здесь явно и повторены в areve-frontend.
 *
 * Источник истины — docs/project-plan.md, раздел 3.
 * Меняете договор — правьте документ и обе стороны, иначе сервер ответит
 * кодом, которого форма не знает, и родитель увидит заглушку вместо фразы.
 */

/** Коды, на перевод которых рассчитывает фронтенд. */
const PUBLISHED_ERROR_CODES = [
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "CONFLICT",
  "FORBIDDEN",
  "RATE_LIMITED",
  "INTERNAL",
];

test("набор кодов ошибок не менялся без ведома фронтенда", () => {
  assert.deepEqual(
    Object.values(ErrorCode).sort(),
    [...PUBLISHED_ERROR_CODES].sort(),
    "коды разошлись с договором — обновите docs/project-plan.md и переводы в areve-frontend"
  );
});

test("имя поля-ловушки не менялось", () => {
  assert.equal(
    HONEYPOT_FIELD,
    "website",
    "форма отправляет поле «website» — переименование здесь отключит отсев ботов"
  );
});
