// Records frontend query_context goldens by running the SAME buildQuery entry
// under Node's V8 (independent of the backend mini-racer runtime). Pure buildQuery
// logic → identical output to the browser. Writes __fixtures__/expected/<stem>.json.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const FEX = 'src/backend-querycontext/__fixtures__';

const res = await build({
  entryPoints: ['src/backend-querycontext/entry.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  write: false,
  legalComments: 'none',
});
const code = res.outputFiles[0].text;
// Same minimal browser-global shims the backend mini-racer runner injects — the
// browser-target bundle touches `window`/`self` at module load.
const shim = (k, v) => {
  try {
    if (globalThis[k] === undefined) globalThis[k] = v;
  } catch {
    /* read-only builtin (e.g. Node's navigator) — leave it */
  }
};
shim('self', globalThis);
shim('window', globalThis);
shim('navigator', { userAgent: 'superset-goldens-node' });
shim('document', {});
const mod = { exports: {} };
new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
const gen = mod.exports.generateQueryContext || globalThis.generateQueryContext;
if (typeof gen !== 'function') throw new Error('generateQueryContext not found in bundle');

mkdirSync(`${FEX}/expected`, { recursive: true });
for (const f of readdirSync(`${FEX}/formdata`)) {
  if (!f.endsWith('.json')) continue;
  const stem = f.replace(/\.json$/, '');
  const fdJson = readFileSync(`${FEX}/formdata/${f}`, 'utf8');
  const outStr = gen(stem, fdJson);
  const parsed = JSON.parse(outStr);
  if (parsed && (parsed.__unsupported__ || parsed.__error__)) {
    throw new Error(`golden gen failed for ${stem}: ${outStr}`);
  }
  writeFileSync(`${FEX}/expected/${stem}.json`, JSON.stringify(parsed, null, 2) + '\n');
  console.log(`golden recorded: ${stem} (queries=${(parsed.queries || []).length})`);
}
