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
