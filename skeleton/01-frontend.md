# 01. Фронтенд

SPA на React 19 + TypeScript + Vite 8, стили — Tailwind CSS 3.
Роутинг — react-router-dom 7, состояние — Zustand 5, HTTP — Axios,
формы — react-hook-form + zod. Архитектура — **Feature-Sliced Design (FSD)**.

## 1. Дерево

```
frontend/
  index.html  vite.config.ts  tsconfig*.json  eslint.config.js
  tailwind.config.js  postcss.config.js  .env.example
  tools/check-fsd.cjs           проверка архитектуры (05-arch-checks.md)
  src/
    main.tsx                    точка входа
    app/                        сборка приложения
      index.tsx                 провайдеры + роутер
      Router.tsx                все маршруты
      providers/                ThemeProvider
      layouts/                  AppLayout
      styles/App.css            @tailwind + переменные темы
    pages/                      экраны
    widgets/                    крупные самостоятельные блоки
    features/                   действия пользователя (Theme, Language, …)
    entities/                   предметные сущности
    shared/                     ничего не знает о слоях выше
      api/                      axios-клиент
      config/                   чтение VITE_* переменных
      lib/                      cn, getErrorMessage
      i18n/                     переводы (03-i18n.md)
      ui/                       базовые компоненты
      mocks/                    мок-адаптер axios
```

Путь до файла отвечает на три вопроса: **слой** (кто кому может быть известен),
**слайс** (о чём это), **сегмент** (что это за код).

## 2. Правила расположения кода

Проверяются `npm run check:arch`; каждая правка оставляет проверку зелёной.

### Слои

Порядок снизу вверх: `shared` → `entities` → `features` → `widgets` → `pages` → `app`.
**Импорт разрешён только вниз.**

### Слайсы

- Слайс в `entities`, `features`, `widgets`, `pages` — каталог с `index.ts` (публичный API).
- **К чужому слайсу — только через его `index.ts`.**
- **Внутри своего слайса — относительные пути**, не через свой `index.ts` (круг).
- **Слайсы одного слоя друг друга не импортируют.** Исключение — сущности:
  одна отдаёт другой API через `@x`: `entities/A/@x/b.ts` для слайса `B`.

### Сегменты

| Сегмент | Что кладём |
|---|---|
| `ui/` | компоненты (`.tsx`) |
| `model/` | хуки (`use*`), сторы, типы |
| `api/` | обращения к серверу |
| `zod/` | схемы форм |
| `lib/` | помощники без разметки |
| `config/` | константы |
| `@x/` | только у сущностей |

Хук вне `model/`, компонент вне `ui/`, файл в корне слайса (кроме `index.ts`) — ошибка.

### `shared`

Слайсов нет, только сегменты `api`, `lib`, `ui`, `config`, `mocks`, `i18n`;
между собой обращаются напрямую. В `ui/` — только компоненты; помощники
общего назначения (`cn`) — в `lib/`, и `ui/index.ts` их не реэкспортирует.

### Пути

Между слайсами и слоями — псевдоним `@/…`, никаких `../../..`. Псевдоним объявлен
дважды и должен совпадать: `vite.config.ts` и `tsconfig.app.json`.

### Страницы и каркасы

- Экран: `pages/<Page>/ui/<Page>Page.tsx` + `pages/<Page>/index.ts`. Группировка
  допустима: `pages/<Group>/<Page>/…` (у папки группы нет `index.ts`).
- `Router.tsx` импортирует только `@/pages/<Page>`.
- Каркасы страниц живут в `app/layouts`: они собирают виджеты и страницы.

### Мёртвый код

Файл, на который никто не ссылается, удаляется. `check:arch` находит файлы,
недостижимые от `main.tsx`.

## 3. Точка входа

```tsx
// src/main.tsx
import ReactDOM from "react-dom/client";
import App from "@/app";
import "@/app/styles/App.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found in index.html");

ReactDOM.createRoot(container).render(<App />);
```

```tsx
// src/app/index.tsx
import { ThemeProvider } from "./providers/ThemeProvider";
import Router from "./Router";

const App = () => (
  <ThemeProvider>
    <Router />
  </ThemeProvider>
);

export default App;
```

## 4. Маршрутизация

```tsx
// src/app/Router.tsx
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "@/pages/Home";
import { AppLayout } from "./layouts/AppLayout";

const Router = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

export default Router;
```

```tsx
// src/app/layouts/AppLayout.tsx
import { Outlet } from "react-router-dom";

export const AppLayout = () => (
  <div className="min-h-screen">
    <Outlet />
  </div>
);
```

Статичный сегмент объявляется **до** параметрического: `/items/new` раньше `/items/:id`.

## 5. Конфиг окружения

```ts
// src/shared/config/index.ts
export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:5001/api",
  /** Мок-режим: ответы берутся из локальных данных, сервер не нужен. */
  useMocks: import.meta.env.VITE_USE_MOCKS === "true",
} as const;
```

## 6. HTTP-клиент

```ts
// src/shared/api/client.ts
import axios from "axios";
import { config } from "@/shared/config";

export const api = axios.create({ baseURL: config.apiUrl });

/*
 * Мок-режим подменяет транспорт целиком: вызовы, интерцепторы и разбор ошибок
 * работают без изменений, в компонентах нет ни одного `if (useMocks)`.
 * Сравнение с литералом, а не через config: Vite подставляет значение на сборке
 * и вырезает ветку вместе с динамическим импортом из продакшен-бандла.
 */
if (import.meta.env.VITE_USE_MOCKS === "true") {
  const { mockAdapter } = await import("@/shared/mocks/adapter");
  api.defaults.adapter = mockAdapter;
  console.info("Mock mode: requests do not reach the server");
}
```

```ts
// src/shared/api/index.ts
export { api } from "./client";
```

Запросы предметной области живут в сегменте `api/` своей сущности:
`entities/<Entity>/api/<entity>Api.ts`.

## 7. Разбор ошибок

Сервер отдаёт ошибки конвертом `{ error: { code, message, details? } }`
(`02-backend.md`). Текст для пользователя собирает фронтенд по `code`.

```ts
// src/shared/lib/getErrorMessage.ts
import axios from "axios";
import { translate, TRANSLATED_ERROR_CODES, type TranslationKey } from "@/shared/i18n";

type ErrorEnvelope = { error?: { code?: string; message?: string; details?: unknown } };

/** `fallback` — ключ перевода: вызывающий не решает, на каком языке говорить. */
export function getErrorMessage(error: unknown, fallback: TranslationKey): string {
  const fallbackText = translate(fallback);
  if (!axios.isAxiosError(error)) return fallbackText;

  const payload = (error.response?.data as ErrorEnvelope | undefined)?.error;
  const code = payload?.code;

  if (code && TRANSLATED_ERROR_CODES.has(code)) {
    return translate(`errors.${code}` as TranslationKey);
  }

  // Незнакомый код: серверный текст лучше заглушки, но только на 4xx —
  // в 5xx может попасть содержимое исключения.
  const status = error.response?.status ?? 0;
  if (payload?.message && status >= 400 && status < 500) return payload.message;

  return fallbackText;
}

/** Код ошибки — когда нужно отличить случай, а не показать текст. */
export function getErrorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  return (error.response?.data as ErrorEnvelope | undefined)?.error?.code;
}
```

```ts
// src/shared/lib/cn.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** tailwind-merge разрешает конфликты: внешний className="px-2" перебивает внутренний px-4. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

```ts
// src/shared/lib/index.ts
export { cn } from "./cn";
export { getErrorMessage, getErrorCode } from "./getErrorMessage";
```

## 8. Данные

Хуки на `useState + useEffect`; флаг `cancelled`, чтобы не писать в
размонтированный компонент.

```ts
// src/features/<Items>/model/useItems.ts
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/shared/lib";
import { listItems, type Item } from "@/entities/Item";

export function useItems() {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    listItems()
      .then((data) => { if (!cancelled) setItems(data); })
      .catch((err) => { if (!cancelled) setError(getErrorMessage(err, "errors.loadFailed")); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return { items, error, loading };
}
```

- Независимые запросы одного экрана — `Promise.allSettled`.
- Состояние, зависящее от параметра, выводится из данных, а не выставляется
  `setState` в теле эффекта.
- Понадобятся кэш и ретраи — подключается TanStack Query.

## 9. Формы

react-hook-form + zod, схема в сегменте `zod/`. **Схема хранит ключ перевода,
а не текст** — она создаётся один раз при загрузке модуля, и текст застыл бы на
языке того момента.

```ts
// src/features/<Form>/zod/schema.ts
import { z } from "zod";

export const ItemSchema = z.object({
  title: z.string().min(1, "validation.required").max(200, "validation.tooLong"),
});
export type ItemValues = z.infer<typeof ItemSchema>;
```

```tsx
// src/features/<Form>/ui/ItemForm.tsx (фрагмент)
const t = useT();
const fieldError = useFieldError(); // ключ → текст на каждой отрисовке
const { register, handleSubmit, formState } = useForm<ItemValues>({
  resolver: zodResolver(ItemSchema),
});

<label>
  {t("items.title")}
  <input {...register("title")} />
  <span>{fieldError(formState.errors.title?.message)}</span>
</label>
```

## 10. Тёмная и светлая тема

Тема — атрибут `data-theme="light" | "dark"` на `<html>`. Цвета заданы
CSS-переменными в `App.css` (`04-configs.md`), компоненты используют их через
Tailwind и о теме не знают. Стор темы — в `features/Theme`, применение к
документу — только в `app/providers/ThemeProvider`.

```ts
// src/features/Theme/model/themeStore.ts
import { create } from "zustand";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

const readStored = (): Theme => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    // приватный режим или запрет хранилища
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const applyTheme = (theme: Theme) => {
  document.documentElement.setAttribute("data-theme", theme);
};

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: readStored(),
  setTheme: (theme) => {
    set({ theme }); // к документу применяет только ThemeProvider
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // недоступное хранилище не ломает переключение
    }
  },
}));
```

```ts
// src/features/Theme/index.ts
export { useThemeStore, applyTheme, type Theme } from "./model/themeStore";
export { ThemeToggle } from "./ui/ThemeToggle";
```

```tsx
// src/features/Theme/ui/ThemeToggle.tsx
import { useT } from "@/shared/i18n";
import { useThemeStore } from "../model/themeStore";

export const ThemeToggle = () => {
  const t = useT();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme === "dark" ? t("common.themeLight") : t("common.themeDark")}
    </button>
  );
};
```

```tsx
// src/app/providers/ThemeProvider.tsx
import { useEffect } from "react";
import { applyTheme, useThemeStore } from "@/features/Theme";

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => applyTheme(theme), [theme]);
  return <>{children}</>;
};
```

Чтобы при загрузке не мигала неверная тема, `index.html` выставляет атрибут
до первой отрисовки (`04-configs.md`).

## 11. Мок-режим

```ts
// src/shared/mocks/adapter.ts
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from "axios";
import * as state from "./state";

// Типы из entities не импортируются: shared не зависит от слоёв выше.

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ok = <T>(config: AxiosRequestConfig, data: T, status = 200): AxiosResponse<T> => ({
  data, status, statusText: "OK", headers: {}, config: config as never,
});

// Ошибка в том же конверте, что у сервера.
const fail = (config: AxiosRequestConfig, status: number, code: string, message: string) =>
  Promise.reject(
    Object.assign(new Error(message), {
      isAxiosError: true,
      config,
      response: { status, data: { error: { code, message } }, headers: {}, config },
    })
  );

type Handler = (config: AxiosRequestConfig, params: Record<string, string>) => Promise<AxiosResponse>;

const routes: Array<[method: string, pattern: string, handler: Handler]> = [
  ["get", "/items", async (c) => ok(c, { items: state.items })],
  ["get", "/items/:id", async (c, p) => {
    const item = state.items.find((i) => i.id === p.id);
    return item ? ok(c, item) : fail(c, 404, "NOT_FOUND", "Not found");
  }],
];

const match = (pattern: string, url: string) => {
  const names: string[] = [];
  const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, n) => (names.push(n), "([^/]+)")) + "$");
  const m = url.match(re);
  return m ? Object.fromEntries(names.map((n, i) => [n, m[i + 1]])) : null;
};

export const mockAdapter: AxiosAdapter = async (config) => {
  await delay(250);
  const url = (config.url ?? "").split("?")[0];
  const method = (config.method ?? "get").toLowerCase();

  for (const [m, pattern, handler] of routes) {
    const params = m === method ? match(pattern, url) : null;
    if (params) return handler(config, params);
  }
  return fail(config, 404, "NOT_FOUND", `Mock route not found: ${method.toUpperCase()} ${url}`);
};
```

```ts
// src/shared/mocks/state.ts — изменяемые данные в памяти, живут до перезагрузки
export const items = [
  { id: "1", title: "First item" },
  { id: "2", title: "An item with a noticeably long title to check wrapping" },
];
```
