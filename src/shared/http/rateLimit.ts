import { Request, Response, NextFunction, RequestHandler } from "express";
import { AppError } from "../errors/AppError";

interface Options {
  /** Длина окна в миллисекундах. */
  windowMs: number;
  /** Сколько запросов с одного адреса разрешено за окно. */
  max: number;
}

/**
 * Счётчик запросов на адрес, окно фиксированной длины.
 *
 * Хранится в памяти процесса, а не в базе: IP — такие же персональные данные,
 * как имя и телефон, и складывать их рядом с заявками незачем. Плата за это —
 * счётчик обнуляется при перезапуске и не общий для нескольких процессов.
 * Для одной формы на лендинге это приемлемо; если сервер поедет в несколько
 * процессов, счётчик нужно вынести во внешнее хранилище.
 *
 * Границу окна не сглаживаем: на стыке двух окон теоретически пройдёт 2×max
 * запросов. Для защиты от потока с одного адреса этого достаточно.
 */
export function rateLimit({ windowMs, max }: Options): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Без уборки карта росла бы с каждым новым адресом до конца жизни процесса.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  sweeper.unref(); // таймер не должен удерживать процесс при остановке

  return (req: Request, res: Response, next: NextFunction) => {
    /*
     * req.ip берётся из сокета, а за прокси — из X-Forwarded-For, но только
     * если в app.ts выставлен trust proxy. Без него все запросы из-за прокси
     * пришли бы с одного адреса и ограничение отсекло бы живых родителей.
     */
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      // Retry-After: клиент должен знать, когда пробовать снова.
      const secondsLeft = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(secondsLeft));
      return next(AppError.tooManyRequests());
    }

    next();
  };
}
