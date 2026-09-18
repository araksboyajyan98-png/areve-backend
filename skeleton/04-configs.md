# 04. Конфиги

Версии — на сентябрь 2026; в новом проекте ставить актуальные.

## Фронтенд

### `package.json`

```json
{
  "name": "<app>-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "check:arch": "node tools/check-fsd.cjs",
    "prepare": "husky || true"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.4.0",
    "axios": "^1.16.1",
    "clsx": "^2.1.1",
    "i18next": "^26.4.2",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-hook-form": "^7.76.1",
    "react-i18next": "^17.0.13",
    "react-router-dom": "^7.15.1",
    "tailwind-merge": "^2.6.1",
    "zod": "^4.4.3",
    "zustand": "^5.0.13"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/node": "^24.12.3",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "autoprefixer": "^10.5.0",
    "eslint": "^10.3.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.6.0",
    "husky": "^9.1.7",
    "lint-staged": "^16.4.0",
    "postcss": "^8.5.15",
    "tailwindcss": "^3.3.5",
    "typescript": "~6.0.2",
    "typescript-eslint": "^8.59.2",
    "vite": "^8.0.12"
  },
  "lint-staged": {
    "*.{ts,tsx}": "eslint --fix"
  },
  "engines": {
    "node": ">=20.19"
  }
}
```

### `vite.config.ts`

```ts
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // должен совпадать с paths в tsconfig.app.json
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true, // не уходить на соседний порт — иначе он не попадёт в CORS бэкенда
  },
});
```

### `tsconfig.json`

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

### `tsconfig.app.json`

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client"],
    "paths": { "@/*": ["./src/*"] },
    "skipLibCheck": true,

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "types": ["node"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

### `src/vite-env.d.ts`

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_USE_MOCKS?: "true" | "false";
}
```

### `eslint.config.js`

```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
]);
```

### `postcss.config.js`

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### `tailwind.config.js`

Только механизм темы: цвета берутся из CSS-переменных, которые переключаются
атрибутом `data-theme`. Палитру и шрифты задаёт дизайн нового проекта.

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // имена — по смыслу, значения — в App.css для каждой темы
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        text: "rgb(var(--color-text) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};
```

### `src/app/styles/App.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/*
 * Переменные темы. Формат "R G B" без rgb(), чтобы работала прозрачность (bg-bg/50).
 * Значения ниже — заглушки; палитру задаёт дизайн проекта. Новый цвет
 * добавляется в обе темы и в tailwind.config.js.
 */
@layer base {
  :root,
  :root[data-theme="light"] {
    --color-bg: 255 255 255;
    --color-text: 0 0 0;
    color-scheme: light;
  }

  :root[data-theme="dark"] {
    --color-bg: 0 0 0;
    --color-text: 255 255 255;
    color-scheme: dark;
  }

  html, body, #root { height: 100%; }

  body {
    margin: 0;
    background-color: rgb(var(--color-bg));
    color: rgb(var(--color-text));
  }
}
```

### `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><app></title>
    <!-- Тема до первой отрисовки: иначе мигает неверная. Ключ совпадает с themeStore. -->
    <script>
      (function () {
        var theme;
        try { theme = localStorage.getItem("theme"); } catch (e) {}
        if (theme !== "light" && theme !== "dark") {
          theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
        document.documentElement.setAttribute("data-theme", theme);
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `.env.example`

```bash
# Скопируйте в .env — он в git не попадает.
VITE_API_URL=http://localhost:5001/api

# Мок-данные вместо запросов: интерфейс без бэкенда.
VITE_USE_MOCKS=false
```

`VITE_*` подставляются на сборке, а не в рантайме.

## Бэкенд

### `package.json`

```json
{
  "name": "<app>-backend",
  "private": true,
  "main": "dist/server.js",
  "scripts": {
    "dev": "nodemon --exec ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "check:arch": "node tools/check-architecture.cjs",
    "prepare": "husky || true"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "express-validator": "^7.3.2",
    "helmet": "^8.2.0",
    "pino": "^10.3.1",
    "pino-http": "^11.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/node": "^25.9.1",
    "eslint": "^10.10.0",
    "globals": "^17.12.0",
    "husky": "^9.1.7",
    "lint-staged": "^16.4.0",
    "nodemon": "^3.1.14",
    "pino-pretty": "^13.1.3",
    "prisma": "^5.22.0",
    "ts-node": "^10.9.2",
    "typescript": "^6.0.3",
    "typescript-eslint": "^8.69.0"
  },
  "lint-staged": {
    "*.ts": "eslint --fix"
  },
  "engines": {
    "node": ">=20.19"
  }
}
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "node16",
    "moduleResolution": "node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `eslint.config.mjs`

Именно `.mjs`: проект на CommonJS, а конфиг — ES-модуль.

```js
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "prisma/migrations"]),
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    rules: {
      // caughtErrors: "all" ловит потерю исходной ошибки при перебросе;
      // ненужную ошибку называть `_error` или писать `catch {}`
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);
```

### `.env.example`

```bash
# Скопируйте в .env и заполните. Сам .env в git не попадает.
PORT=5001
NODE_ENV=development
# debug | info | warn | error
LOG_LEVEL=debug

DATABASE_URL="postgresql://user:password@localhost:5432/<app>"

# Разрешённые origin фронтенда через запятую
CORS_ORIGINS=http://localhost:5173
```

Новая переменная добавляется в `.env.example` в той же правке; обязательная —
ещё и в `REQUIRED_ENV_VARS` в `server.ts`.

## Общее

### Husky pre-commit

`frontend/.husky/pre-commit`:

```sh
npx lint-staged
npx tsc -b --noEmit
```

`backend/.husky/pre-commit`:

```sh
npx lint-staged
npx tsc --noEmit
```

### `.gitignore`

```gitignore
node_modules/
dist/
.env
*.log
.DS_Store
```
