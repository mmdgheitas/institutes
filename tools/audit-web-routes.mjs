/**
 * Route audit: verifies every URL used by the web client exists in the API
 * controllers. Run: node tools/audit-web-routes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve relative to the repo root regardless of the caller's cwd.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.controller.ts')) out.push(full);
  }
  return out;
}

// 1) API routes from controllers.
const apiRoutes = [];
for (const file of walk(path.join(ROOT, 'apps/api/src/modules'))) {
  const src = fs.readFileSync(file, 'utf8');
  const prefix = (src.match(/@Controller\(([^)]*)\)/)?.[1] ?? '').replace(/['"]/g, '');
  for (const m of src.matchAll(/@(Get|Post|Patch|Put|Delete)\((['"])([^'"]*)\2\)/g)) {
    apiRoutes.push([prefix, m[3]].filter(Boolean).join('/').replace(/\/+/g, '/'));
  }
  for (const m of src.matchAll(/@(Get|Post|Patch|Put|Delete)\(\)/g)) {
    apiRoutes.push(prefix);
  }
}

// 2) URL literals used by the web client (backtick templates AND single quotes).
const web = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/api/endpoints.ts'), 'utf8');
const literals = [];
let i = 0;
while (i < web.length) {
  const startB = web.indexOf('`', i);
  const startS = web.indexOf("'", i);
  const start = startB === -1 ? startS : startS === -1 ? startB : Math.min(startB, startS);
  if (start === -1) break;
  const quote = web[start];
  let depth = 0;
  let j = start + 1;
  let end = -1;
  while (j < web.length) {
    const ch = web[j];
    if (ch === '\\') {
      j += 2;
      continue;
    }
    if (ch === quote) {
      if (depth === 0) {
        end = j;
        break;
      }
    }
    if (quote === '`' && ch === '$' && web[j + 1] === '{') depth += 1;
    if (ch === '}' && depth > 0) depth -= 1;
    j += 1;
  }
  if (end === -1) break;
  literals.push(web.slice(start + 1, end));
  i = end + 1;
}
const used = literals.filter((t) => t.startsWith('/'));

const norm = (p) => p.replace(/^\/+/, '').replace(/:[a-zA-Z]+/g, ':p').replace(/\/+$/, '');
const apiSet = new Set(apiRoutes.map(norm));

const missing = [];
for (const t of used) {
  const reduced = t
    .replace(/\$\{qs\([^)]*\)\}/g, '') // query-string builder
    .replace(/\$\{months\}/g, '') // revenue months param
    .replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, ':p') // path params
    .replace(/\?.*$/, '');
  if (!apiSet.has(norm(reduced))) missing.push(`${reduced}   (from: ${t.slice(0, 55)})`);
}

console.log(`API routes: ${apiRoutes.length} | unique: ${apiSet.size} | web literals: ${used.length}`);
console.log(`Missing (${missing.length}):`);
for (const m of missing) console.log(' ', m);
