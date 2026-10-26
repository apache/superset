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
import { createTransformer as createSwcTransformer } from '@swc/jest';

/**
 * Jest transformer: @swc/jest plus one post-processing step.
 *
 * SWC's CommonJS output defines every ESM export as a lazy, non-configurable
 * getter, which is why `jest.spyOn(module, 'name')` and
 * `jest.replaceProperty(module, 'name', value)` throw "Cannot redefine
 * property" on anything SWC transformed. Babel's output defined plain
 * properties, so the suite relies on spying on module exports everywhere.
 * This wrapper marks those getters `configurable: true` so the spies keep
 * working, while leaving the getters lazy (an eager rewrite would break
 * modules that import each other in a cycle).
 *
 * The second difference is what a module in an import cycle sees when it
 * reads an export that has not been initialised yet. Babel assigns
 * `exports.name = void 0` up front, so the read yields `undefined`; SWC's
 * getter returns the live binding and throws a ReferenceError (temporal dead
 * zone) instead. Several suites spread `jest.requireActual()` of a module
 * that is still mid-evaluation, so the getters are made lenient to match
 * Babel: an uninitialised export reads as `undefined`.
 */
// SWC keeps a leading comment of a default export inside the call, as
// `Object.defineProperty(exports, /** ... */ "default", {` or
// `Object.defineProperty(exports, // ...\n"default", {`, hence the optional
// block or line comments before the name.
const COMMENTS = String.raw`(?:(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*)\s*)*`;
const DESCRIPTOR_HEAD = String.raw`Object\.defineProperty\((?:target, name|to, k|exports,\s*${COMMENTS}"[^"]+")`;
const EXPORT_GETTER_DESCRIPTOR = new RegExp(
  String.raw`(${DESCRIPTOR_HEAD}, \{\s*enumerable: true,)(\s*)(get:)`,
  'g',
);
// A direct `Object.defineProperty(exports, "name", { enumerable, get` export
// (no `_export(` call), as emitted for single-export modules.
const DIRECT_EXPORT_GETTER = new RegExp(
  String.raw`Object\.defineProperty\(exports,\s*${COMMENTS}"(?!__esModule")[^"]+", \{\s*enumerable: true,\s*get\b`,
);
// `_export(exports, { get name () { return binding; }, ... });` is how SWC
// declares named exports; the leniency below is scoped to this block and to
// the `Object.defineProperty(exports, ...)` descriptors, never to getters in
// application code.
const EXPORT_BLOCK = /_export\(exports, \{[\s\S]*?\n\}\);/g;
// A commented default export also leaves its comment inside the block, between
// `get` and the name: `get // Wrap in memo\n default () {`.
const EXPORT_BLOCK_GETTER = new RegExp(
  String.raw`(get\s+${COMMENTS}[\w$]+ \(\) \{\s*)return ([\w$]+(?:\.[\w$]+)*);`,
  'g',
);
// The `get: function() { return binding; }` form SWC uses for a single export
// or a re-export (`from[k]`), matched together with its descriptor.
const EXPORT_DESCRIPTOR_GETTER = new RegExp(
  String.raw`(${DESCRIPTOR_HEAD}, \{\s*enumerable: true,\s*)(get: function\(\) \{\s*)return ([\w$]+(?:\.[\w$]+)*|from\[k\]);`,
  'g',
);

// Only a TDZ ReferenceError is swallowed; any other error still propagates.
// The istanbul hint keeps the injected try/catch out of coverage instrumentation
// so exported bindings do not report uncovered branches.
const lenient = binding =>
  `/* istanbul ignore next */ try { return ${binding}; } catch (e) { if (!(e instanceof ReferenceError)) throw e; return undefined; }`;

function rewriteExports(code) {
  return code
    .replace(
      EXPORT_DESCRIPTOR_GETTER,
      (_m, head, getter, binding) => `${head}${getter}${lenient(binding)}`,
    )
    .replace(EXPORT_BLOCK, block =>
      block.replace(
        EXPORT_BLOCK_GETTER,
        (_m, head, binding) => `${head}${lenient(binding)}`,
      ),
    )
    .replace(EXPORT_GETTER_DESCRIPTOR, '$1 configurable: true,$2$3');
}

export function mirrorBabelExportSemantics(code) {
  const patched = rewriteExports(code);
  // A shape change in SWC's export helpers would otherwise leave exports
  // non-configurable, surfacing later as scattered "Cannot redefine property"
  // errors or TDZ ReferenceErrors in unrelated suites.
  if (
    (/\b_export\(/.test(code) || DIRECT_EXPORT_GETTER.test(code)) &&
    /enumerable: true,\s*get\b/.test(code) &&
    !patched.includes('configurable: true')
  ) {
    throw new Error(
      'swcJestTransformer: SWC export output did not match any known shape; ' +
        'update the patterns in spec/helpers/swcJestTransformer.js',
    );
  }
  // The helper descriptor always supplies `configurable: true`, so a changed
  // named-getter shape would otherwise lose only the leniency half unnoticed.
  if (
    new RegExp(
      String.raw`\b_export\(exports, \{[\s\S]*?\bget\s+${COMMENTS}[\w$]+\s*\(`,
    ).test(code) &&
    !patched.includes('try { return')
  ) {
    throw new Error(
      'swcJestTransformer: SWC named export getters did not match the known ' +
        'shape; update the patterns in spec/helpers/swcJestTransformer.js',
    );
  }
  return patched;
}

function patch(result) {
  if (typeof result === 'string') return mirrorBabelExportSemantics(result);
  return { ...result, code: mirrorBabelExportSemantics(result.code) };
}

const withPatch =
  fn =>
  (...args) => {
    const result = fn(...args);
    return result && typeof result.then === 'function'
      ? result.then(patch)
      : patch(result);
  };

// Bump when the post-processing changes so cached transforms are invalidated.
const CACHE_SALT = 'babel-export-semantics-v9';

export function createTransformer(swcOptions) {
  const swc = createSwcTransformer(swcOptions);
  return {
    ...swc,
    process: withPatch(swc.process.bind(swc)),
    processAsync: withPatch(swc.processAsync.bind(swc)),
    getCacheKey: (...args) => `${swc.getCacheKey(...args)}-${CACHE_SALT}`,
  };
}

export default { createTransformer };
