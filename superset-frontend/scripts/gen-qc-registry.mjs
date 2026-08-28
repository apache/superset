/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Deterministic, re-runnable codegen: maps every plugin `buildQuery` module to the
// viz_type key(s) it is registered under, and emits registry.generated.ts consumed
// by entry.ts. Join: buildQuery module  <- (index.ts that imports it) -> plugin class
// name -> MainPreset `.configure({ key: VizType.X })` -> VizType enum string.
// A single builder legitimately maps to several keys (e.g. echarts_timeseries + _line/_bar/...).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGINS = path.join(FE, 'plugins');
const OUT = path.join(FE, 'src', 'backend-querycontext', 'registry.generated.ts');

// --- 1. VizType enum: EnumName -> 'string_value' ---
const vizTypeSrc = readFileSync(
  path.join(FE, 'packages/superset-ui-core/src/chart/types/VizType.ts'),
  'utf8',
);
const VIZ_ENUM = {};
for (const m of vizTypeSrc.matchAll(/(\w+)\s*=\s*['"]([\w-]+)['"]/g)) VIZ_ENUM[m[1]] = m[2];

// --- 2. MainPreset: ClassName -> viz string ---
const mainPreset = readFileSync(
  path.join(FE, 'src/visualizations/presets/MainPreset.ts'),
  'utf8',
);
// MainPreset renames on import (e.g. `import { PivotTableChartPlugin as
// PivotTableChartPluginV2 } from '...'`), then `new PivotTableChartPluginV2()`. Map
// each local `new X()` name back to the ORIGINAL package export name the codegen sees.
const importOrig = {}; // localName -> package-export name
for (const im of mainPreset.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g)) {
  for (let spec of im[1].split(',')) {
    spec = spec.trim();
    if (!spec) continue;
    const as = spec.match(/^(\w+)\s+as\s+(\w+)$/);
    if (as) importOrig[as[2]] = as[1];
    else if (/^\w+$/.test(spec)) importOrig[spec] = spec;
  }
}
const CLASS_TO_VIZ = {};
for (const m of mainPreset.matchAll(
  /new\s+(\w+)\s*\(\s*\)\s*\.configure\(\s*\{\s*key:\s*VizType\.(\w+)/g,
)) {
  const [, local, enumName] = m;
  if (!VIZ_ENUM[enumName]) continue;
  CLASS_TO_VIZ[importOrig[local] ?? local] = VIZ_ENUM[enumName];
  CLASS_TO_VIZ[local] = VIZ_ENUM[enumName]; // also accept the local alias
}

// --- collect all index.ts + buildQuery modules under plugins/ ---
function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (e === 'node_modules' || e === 'test' || e === '__tests__') continue;
      walk(p, acc);
    } else acc.push(p);
  }
  return acc;
}
const files = walk(PLUGINS);
const indexFiles = files.filter((f) => /[/\\]index\.ts$/.test(f));
const buildQueryFiles = files.filter((f) => /[/\\]buildQuery\.(ts|js)$/.test(f));

// resolve an import specifier from a file to an absolute module file (ts/js/index)
function resolveImport(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const c of [
    base,
    `${base}.ts`,
    `${base}.js`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.js'),
  ]) {
    if (existsSync(c) && statSync(c).isFile()) return path.resolve(c);
  }
  return null;
}

// --- re-export graph: node "NAME@file" or "DEF@file"; edge to the module it forwards to.
// Lets us find every alias under which a subdir's DEFAULT export (a plugin class) is
// visible in the package barrels MainPreset imports from (handles `default as Alias`
// renames + multi-hop named passthrough like BigNumber). ---
const edges = new Map(); // node -> node it forwards to
const key = (name, file) => `${name}@${file}`;
for (const idx of indexFiles) {
  const src = readFileSync(idx, 'utf8');
  for (const m of src.matchAll(/export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const target = resolveImport(idx, m[2]);
    if (!target) continue;
    for (let spec of m[1].split(',')) {
      spec = spec.trim();
      if (!spec) continue;
      let dm;
      if ((dm = spec.match(/^default\s+as\s+(\w+)$/)))
        edges.set(key(dm[1], idx), key('DEF', target)); // Alias = default of target
      else if ((dm = spec.match(/^(\w+)\s+as\s+(\w+)$/)))
        edges.set(key(dm[2], idx), key(dm[1], target)); // Y = target's X
      else if ((dm = spec.match(/^(\w+)$/)))
        edges.set(key(dm[1], idx), key(dm[1], target)); // named passthrough
    }
  }
}
// reverse reachability: all alias NAMEs (anywhere) that resolve to DEF@indexFile
function aliasesForDefault(indexFile) {
  const goal = key('DEF', path.resolve(indexFile));
  const out = new Set();
  for (const [from, to] of edges) {
    // does `from` reach goal?
    let cur = to;
    const seen = new Set([from]);
    while (cur && !seen.has(cur)) {
      if (cur === goal) {
        out.add(from.split('@')[0]);
        break;
      }
      seen.add(cur);
      cur = edges.get(cur);
    }
  }
  return out;
}

// --- 3+4. For each buildQuery, find index.ts importing it -> plugin class alias -> viz key ---
const REGISTRY = {}; // viz -> buildQuery abs path
const unmapped = []; // buildQuery with no resolvable viz key
for (const bq of buildQueryFiles) {
  const bqAbs = path.resolve(bq);
  const owningIndexes = new Set();
  for (const idx of indexFiles) {
    const src = readFileSync(idx, 'utf8');
    for (const m of src.matchAll(/import\s+\w+\s+from\s+['"]([^'"]+buildQuery)['"]/g)) {
      if (resolveImport(idx, m[1]) === bqAbs && /export\s+default\s+class\s+\w+/.test(src))
        owningIndexes.add(path.resolve(idx));
    }
  }
  const aliases = new Set();
  for (const idx of owningIndexes) {
    const src = readFileSync(idx, 'utf8');
    const localCls = src.match(/export\s+default\s+class\s+(\w+)/);
    if (localCls) aliases.add(localCls[1]); // direct (unrenamed) registration
    for (const a of aliasesForDefault(idx)) aliases.add(a); // renamed re-exports
  }
  const vizKeys = [...new Set([...aliases].map((c) => CLASS_TO_VIZ[c]).filter(Boolean))];
  if (vizKeys.length === 0)
    unmapped.push({ bq: path.relative(FE, bq), classes: [...aliases] });
  else for (const v of vizKeys) REGISTRY[v] = bqAbs;
}

// --- 5. emit registry.generated.ts ---
const entries = Object.entries(REGISTRY).sort(([a], [b]) => a.localeCompare(b));
let imports = '';
const nameByPath = new Map();
let n = 0;
for (const [, abs] of entries) {
  if (!nameByPath.has(abs)) {
    const id = `bq${n}`;
    n += 1;
    nameByPath.set(abs, id);
    let rel = path
      .relative(path.dirname(OUT), abs)
      .replace(/\\/g, '/')
      .replace(/\.(ts|js)$/, '');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    imports += `import ${id} from '${rel}';\n`;
  }
}
let body = 'export const REGISTRY: Record<string, (fd: any) => any> = {\n';
for (const [viz, abs] of entries) body += `  '${viz}': ${nameByPath.get(abs)} as (fd: any) => any,\n`;
body += '};\n\nexport const VIZ_TYPES: string[] = Object.keys(REGISTRY);\n';

const header = `// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// GENERATED by superset-frontend/scripts/gen-qc-registry.mjs — DO NOT EDIT.
// Re-run: node scripts/gen-qc-registry.mjs
`;
writeFileSync(OUT, `${header}\n${imports}\n${body}`, 'utf8');

console.log(`buildQuery modules: ${buildQueryFiles.length}`);
console.log(`viz keys mapped: ${entries.length}`);
console.log(`keys: ${entries.map(([v]) => v).join(', ')}`);
console.log(`unmapped buildQuery (no MainPreset key): ${unmapped.length}`);
for (const u of unmapped) console.log(`  - ${u.bq} (classes: ${u.classes.join(',') || 'none'})`);
console.log(`wrote ${path.relative(FE, OUT)}`);
