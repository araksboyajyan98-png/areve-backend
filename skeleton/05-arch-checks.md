# 05. Машинная проверка архитектуры

Два скрипта без зависимостей — только встроенные модули Node. Разбирают импорты
и проверяют правила из `01-frontend.md` и `02-backend.md`. Запуск —
`npm run check:arch` в каждой части; зелёный результат обязателен для каждой правки.

## Фронтенд — `frontend/tools/check-fsd.cjs`

Проверяет: файлы вне слоёв; файл в корне слайса; неизвестный сегмент; хук вне
`model/`, компонент вне `ui/`; `@x` не у сущности; у страниц только `ui/`;
импорт вверх по слоям; импорт между слайсами одного слоя (кроме `@x` у
сущностей); обход чужого `index.ts`; `../../..` вместо `@/`; относительный путь
за пределы слайса; свой слайс через собственный `index`; реэкспорт `cn` из
`shared/ui`; **мёртвый код** — файлы, недостижимые от `main.tsx`.

```js
#!/usr/bin/env node
/*
 * Проверка правил Feature-Sliced Design разбором импортов.
 * Правила — docs/architecture.md. Запуск: npm run check:arch
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const LAYERS = ["shared", "entities", "features", "widgets", "pages", "app"];
const SLICED = new Set(["entities", "features", "widgets", "pages"]);
const SEGMENTS = new Set(["ui", "model", "api", "zod", "lib", "config", "@x"]);
const SHARED_SEGMENTS = new Set(["api", "lib", "ui", "config", "mocks", "i18n"]);
const ENTRY = "main.tsx";
const EXT = [".ts", ".tsx", ".d.ts"];
const isIndex = (name) => /^index\.tsx?$/.test(name);

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path.relative(SRC, full).split(path.sep).join("/"));
  }
})(SRC);
const known = new Set(files);

const tryFile = (base) => {
  for (const c of [base, ...EXT.map((e) => base + e), ...EXT.map((e) => `${base}/index${e}`)]) {
    if (known.has(c)) return c;
  }
  return null;
};
const resolve = (from, spec) => {
  if (spec.startsWith("@/")) return tryFile(spec.slice(2));
  if (spec.startsWith(".")) return tryFile(path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)));
  return null;
};

/*
 * Слайс файла. Страницы бывают сгруппированы: pages/Auth/Login — слайс
 * «Auth/Login». Группа — папка без собственного index, внутри которой лежат
 * папки-страницы; всё остальное (pages/Home/ui/…) — обычная страница.
 */
const hasIndex = (dir) => ["index.ts", "index.tsx"].some((n) => fs.existsSync(path.join(dir, n)));
const sliceOf = (file) => {
  const parts = file.split("/");
  const layer = parts[0];
  if (!SLICED.has(layer)) return { layer, slice: null, rest: parts.slice(1) };
  if (layer === "pages" && parts.length > 3 && !SEGMENTS.has(parts[2]) && !hasIndex(path.join(SRC, "pages", parts[1]))) {
    return { layer, slice: `${parts[1]}/${parts[2]}`, rest: parts.slice(3) };
  }
  return { layer, slice: parts[1], rest: parts.slice(2) };
};

/*
 * Комментарии вырезаются, чтобы пример импорта в пояснении не считался
 * импортом. Строки пропускаются как есть: иначе "image/*" съел бы код до «*\/».
 */
const stripComments = (src) => {
  let out = "";
  for (let i = 0; i < src.length; ) {
    const c = src[i], next = src[i + 1];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      i = end < 0 ? src.length : end + 2;
    } else if (c === "/" && next === "/") {
      const end = src.indexOf("\n", i);
      i = end < 0 ? src.length : end;
    } else {
      out += c;
      i++;
    }
  }
  return out;
};
const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;

const violations = [];
const edges = new Map();
// main.tsx — точка входа над app: ей можно всё
const rank = (file, layer) => (file === ENTRY ? LAYERS.length : LAYERS.indexOf(layer));

for (const file of files) {
  const me = sliceOf(file);
  if (file !== ENTRY && file !== "vite-env.d.ts" && LAYERS.indexOf(me.layer) < 0) {
    violations.push(`${file}: вне слоёв FSD`);
  }

  // расположение
  if (SLICED.has(me.layer) && me.slice) {
    const seg = me.rest[0];
    if (me.rest.length === 1 && !isIndex(seg)) violations.push(`${file}: файл в корне слайса — нужен сегмент`);
    if (me.rest.length > 1 && !SEGMENTS.has(seg)) violations.push(`${file}: неизвестный сегмент «${seg}»`);
    if (me.layer === "pages" && me.rest.length > 1 && seg !== "ui") violations.push(`${file}: у страницы только сегмент ui`);
    if (seg === "@x" && me.layer !== "entities") violations.push(`${file}: @x бывает только у сущностей`);
    const base = path.posix.basename(file);
    if (/^use[A-Z].*\.tsx?$/.test(base) && seg !== "model") violations.push(`${file}: хук вне model/`);
    if (base.endsWith(".tsx") && seg !== "ui" && !isIndex(base)) violations.push(`${file}: компонент вне ui/`);
  }
  if (me.layer === "shared" && me.rest.length > 1 && !SHARED_SEGMENTS.has(me.rest[0])) {
    violations.push(`${file}: неизвестный сегмент shared «${me.rest[0]}»`);
  }

  const source = stripComments(fs.readFileSync(path.join(SRC, file), "utf8"));
  for (const [, spec] of source.matchAll(IMPORT_RE)) {
    if (!spec.startsWith("@/") && !spec.startsWith(".")) continue;
    const target = resolve(file, spec);
    if (!target) continue;
    if (!edges.has(file)) edges.set(file, new Set());
    edges.get(file).add(target);
    const them = sliceOf(target);

    if (spec.startsWith(".")) {
      if (spec.startsWith("../../..")) violations.push(`${file} → ${spec}: вместо ../../.. — псевдоним @/`);
      const leaves = SLICED.has(me.layer) ? them.layer !== me.layer || them.slice !== me.slice : them.layer !== me.layer;
      if (file !== ENTRY && leaves) violations.push(`${file} → ${spec}: относительный путь выходит за слайс — нужен @/`);
      if (SLICED.has(me.layer) && !leaves && them.rest.length === 1 && isIndex(them.rest[0])) {
        violations.push(`${file} → ${spec}: свой слайс через собственный index`);
      }
      continue;
    }

    // @/…
    if (rank(target, them.layer) > rank(file, me.layer)) {
      violations.push(`${file} → ${spec}: импорт вверх (${me.layer} → ${them.layer})`);
      continue;
    }
    if (!SLICED.has(them.layer)) continue;
    if (them.layer === me.layer && them.slice === me.slice) {
      violations.push(`${file} → ${spec}: внутри своего слайса — относительные пути`);
      continue;
    }
    const viaIndex = them.rest.length === 1 && isIndex(them.rest[0]);
    // @x: сущность отдаёт соседу отдельный API; имя файла — имя слайса-потребителя
    const viaCross =
      them.layer === "entities" && me.layer === "entities" && them.rest[0] === "@x" && them.rest.length === 2 &&
      them.rest[1].replace(/\.tsx?$/, "").toLowerCase() === me.slice.toLowerCase();
    if (them.layer === me.layer && !viaCross) {
      violations.push(`${file} → ${spec}: импорт между слайсами одного слоя (${me.layer}) — для сущностей через @x`);
    }
    if (!viaIndex && !viaCross) violations.push(`${file} → ${spec}: в чужой слайс только через его index`);
  }
}

// shared/ui не реэкспортирует помощники общего назначения
const uiIndex = path.join(SRC, "shared/ui/index.ts");
if (fs.existsSync(uiIndex) && /\bcn\b/.test(stripComments(fs.readFileSync(uiIndex, "utf8")))) {
  violations.push("shared/ui/index.ts: реэкспортирует cn — он живёт в shared/lib");
}

// мёртвый код: файлы, недостижимые от точки входа
const reach = new Set();
const stack = [ENTRY];
while (stack.length) {
  const f = stack.pop();
  if (!f || reach.has(f)) continue;
  reach.add(f);
  for (const t of edges.get(f) || []) stack.push(t);
}
for (const f of files) {
  if (!reach.has(f) && !f.endsWith(".d.ts")) violations.push(`${f}: недостижим от ${ENTRY} — мёртвый код?`);
}

if (violations.length) {
  console.error(`Нарушения FSD (${violations.length}):`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log(`FSD в порядке: ${files.length} файлов, точка входа ${ENTRY}.`);
```

## Бэкенд — `backend/tools/check-architecture.cjs`

Проверяет: файлы вне `server.ts`, `app/`, `modules/`, `shared/`, `scripts/`;
импорт `app`/`server.ts` кем-либо кроме них; `shared` → модули/приложение; обход
чужого `index.ts`; свой модуль через собственный `index.ts`; **круги между
модулями**. В конце печатает граф зависимостей модулей.

```js
#!/usr/bin/env node
/*
 * Проверка границ модульного монолита разбором импортов.
 * Правила — docs/architecture.md. Запуск: npm run check:arch
 */
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "..", "src");
const ROOT_FILES = new Set(["server.ts"]);
const TOP_DIRS = new Set(["app", "modules", "shared", "scripts"]);

// пути — всегда через «/»: иначе на Windows правила молча перестали бы срабатывать
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".ts")) files.push(path.relative(SRC, full).split(path.sep).join("/"));
  }
})(SRC);

const known = new Set(files);
const resolve = (from, spec) => {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  for (const candidate of [`${base}.ts`, `${base}/index.ts`, `${base}.d.ts`]) {
    if (known.has(candidate)) return candidate;
  }
  return null;
};

const layerOf = (file) => (file.includes("/") ? file.split("/")[0] : "root");
const moduleOf = (file) => (file.match(/^modules\/([^/]+)\//) || [])[1];

// пример импорта в комментарии не должен считаться импортом
const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

// from "…", import "…", import("…"), require("…")
const IMPORT_RE =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["'](\.{1,2}\/[^"']+)["']/g;

const violations = [];
const moduleEdges = new Map();

for (const file of files) {
  const layer = layerOf(file);
  if (layer === "root" ? !ROOT_FILES.has(file) : !TOP_DIRS.has(layer)) {
    violations.push(`${file}: файл вне разрешённых мест (server.ts, app/, modules/, shared/, scripts/)`);
  }

  const source = stripComments(fs.readFileSync(path.join(SRC, file), "utf8"));
  const specs = [...source.matchAll(IMPORT_RE)].map((m) => m[1]);

  for (const spec of specs) {
    const target = resolve(file, spec);
    if (!target) continue;
    const targetLayer = layerOf(target);
    const targetModule = moduleOf(target);
    const viaIndex = targetModule && target === `modules/${targetModule}/index.ts`;

    if (targetLayer === "app" || target === "server.ts") {
      if (layer !== "app" && file !== "server.ts") violations.push(`${file} → ${target}: app и server.ts никто не импортирует`);
      continue;
    }

    if (layer === "shared" && targetLayer !== "shared") {
      violations.push(`${file} → ${target}: shared не знает ни о модулях, ни о приложении`);
      continue;
    }

    if (targetModule) {
      const ownModule = moduleOf(file);
      if (ownModule === targetModule) {
        if (viaIndex) violations.push(`${file} → ${target}: внутри модуля — относительные пути к своим файлам, не через собственный index.ts`);
        continue;
      }
      if (!viaIndex) violations.push(`${file} → ${target}: в чужой модуль только через modules/${targetModule}/index.ts`);
      if (ownModule) {
        if (!moduleEdges.has(ownModule)) moduleEdges.set(ownModule, new Set());
        moduleEdges.get(ownModule).add(targetModule);
      }
    }
  }
}

// круги между модулями: модуль, выделенный в сервис, не может ждать сам себя
const cycles = [];
const state = new Map();
const stack = [];
const visit = (node) => {
  state.set(node, "open");
  stack.push(node);
  for (const next of moduleEdges.get(node) || []) {
    if (state.get(next) === "open") cycles.push([...stack.slice(stack.indexOf(next)), next].join(" → "));
    else if (!state.has(next)) visit(next);
  }
  stack.pop();
  state.set(node, "done");
};
for (const node of moduleEdges.keys()) if (!state.has(node)) visit(node);
for (const cycle of cycles) violations.push(`круг между модулями: ${cycle}`);

if (violations.length) {
  console.error(`Нарушения архитектуры (${violations.length}):`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

const graph = [...moduleEdges.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([from, to]) => `  ${from} → ${[...to].sort().join(", ")}`)
  .join("\n");
console.log(`Архитектура в порядке: ${files.length} файлов.\nЗависимости модулей:\n${graph}`);
```
