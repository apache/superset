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
import { mirrorBabelExportSemantics } from './swcJestTransformer';

// The export-helper text is interpolated so this file is not itself rewritten
// by the transformer when Jest loads it; the fixtures stay raw SWC-shaped input.
const EXPORT_FN = '_export';
const DEFINE = 'defineProperty';
const GET = 'get';
const helper = `function ${EXPORT_FN}(target, all) {
    for(var name in all)Object.${DEFINE}(target, name, {
        enumerable: true,
        ${GET}: Object.getOwnPropertyDescriptor(all, name).get
    });
}`;
const exportsBlock = body => `${EXPORT_FN}(exports, {
${body}
});`;

const NAMED_EXPORTS = `"use strict";
Object.${DEFINE}(exports, "__esModule", {
    value: true
});
${helper}
${exportsBlock(`    ${GET} answer () {
        return answer;
    }`)}
const answer = 42;
`;

function load(code) {
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', code)(mod, mod.exports);
  return mod.exports;
}

test('named exports become configurable so jest.spyOn works', () => {
  const exports = load(mirrorBabelExportSemantics(NAMED_EXPORTS));
  expect(Object.getOwnPropertyDescriptor(exports, 'answer')).toMatchObject({
    configurable: true,
  });
  expect(exports.answer).toBe(42);
});

test('an uninitialised export reads as undefined instead of throwing', () => {
  const code = NAMED_EXPORTS.replace(
    'const answer = 42;',
    'globalThis.__read = exports.answer;\nlet answer = 42;',
  );
  load(mirrorBabelExportSemantics(code));
  expect(globalThis.__read).toBeUndefined();
  delete globalThis.__read;
});

test('throws when an export shape is not recognised', () => {
  const unknown = `_export(foo, {});
Object.defineProperty(foo, "x", {
    enumerable: true,
    get: function() { return 1; }
});`;
  expect(() => mirrorBabelExportSemantics(unknown)).toThrow(
    /did not match any known shape/,
  );
});

test('throws when named export getters change shape but the helper still matches', () => {
  const changed = `${helper}
${exportsBlock(`    ${GET} answer() { return answer; }`)}
const answer = 42;`;
  expect(() => mirrorBabelExportSemantics(changed)).toThrow(
    /named export getters did not match/,
  );
});

test('member-expression and $-named getters are wrapped leniently', () => {
  const code = `"use strict";
${helper}
const dep = { bar: 7 };
${exportsBlock(`    ${GET} $value () {
        return $value;
    },
    ${GET} bar () {
        return dep.bar;
    }`)}
globalThis.__read = [exports.$value, exports.bar];
let $value = 1;
`;
  const patched = mirrorBabelExportSemantics(code);
  expect(patched.match(/try \{ return/g)).toHaveLength(2);
  load(patched);
  expect(globalThis.__read).toEqual([undefined, 7]);
  delete globalThis.__read;
});

test('a line-commented default export is configurable and lenient', () => {
  const code = `"use strict";
Object.${DEFINE}(exports, "__esModule", {
    value: true
});
Object.${DEFINE}(exports, // Wrap in memo
"default", {
    enumerable: true,
    ${GET}: function() {
        return _default;
    }
});
globalThis.__read = exports.default;
const _default = 5;
`;
  const patched = mirrorBabelExportSemantics(code);
  expect(patched).toContain('try { return _default;');
  const exports = load(patched);
  expect(globalThis.__read).toBeUndefined();
  delete globalThis.__read;
  expect(Object.getOwnPropertyDescriptor(exports, 'default')).toMatchObject({
    configurable: true,
  });
  expect(exports.default).toBe(5);
});

test('a commented default export beside named exports is lenient', () => {
  const code = `${helper}
${exportsBlock(`    ${GET} answer () {
        return answer;
    },
    ${GET} // Wrap in memo
    default () {
        return _default;
    }`)}
globalThis.__read = [exports.answer, exports.default];
let answer = 1;
const _default = 5;
`;
  const patched = mirrorBabelExportSemantics(code);
  expect(patched.match(/try \{ return/g)).toHaveLength(2);
  const exports = load(patched);
  expect(globalThis.__read).toEqual([undefined, undefined]);
  delete globalThis.__read;
  expect(exports.default).toBe(5);
});

test('a non-ReferenceError from a re-exported getter propagates', () => {
  const code = `function _exportStar(from, to) {
    Object.keys(from).forEach(function(k) {
        if (k !== "default") Object.${DEFINE}(to, k, {
            enumerable: true,
            ${GET}: function() {
                return from[k];
            }
        });
    });
    return from;
}
const source = {};
Object.${DEFINE}(source, "boom", {
    enumerable: true,
    ${GET}() { throw new TypeError("boom"); }
});
_exportStar(source, exports);
`;
  const exports = load(mirrorBabelExportSemantics(code));
  expect(() => exports.boom).toThrow(TypeError);
});

test('getters outside the export block keep throwing their ReferenceError', () => {
  const code = `${helper}
${exportsBlock(`    ${GET} answer () {
        return answer;
    }`)}
const answer = 1;
const obj = {
    ${GET} value () {
        return later;
    }
};
try {
    obj.value;
} catch (e) {
    globalThis.__early = e.name;
}
let later = 2;
`;
  const patched = mirrorBabelExportSemantics(code);
  expect(patched.match(/try \{ return/g)).toHaveLength(1);
  load(patched);
  expect(globalThis.__early).toBe('ReferenceError');
  delete globalThis.__early;
});

test('a doc-commented default export is configurable and lenient', () => {
  const code = `Object.${DEFINE}(exports, /** doc */ "default", {
    enumerable: true,
    ${GET}: function() {
        return _default;
    }
});
const _default = 5;
`;
  const patched = mirrorBabelExportSemantics(code);
  expect(patched).toContain('try { return _default;');
  expect(
    Object.getOwnPropertyDescriptor(load(patched), 'default'),
  ).toMatchObject({ configurable: true });
});

test('a from[k] re-export is configurable and lenient', () => {
  const code = `function _exportStar(from, to) {
    Object.keys(from).forEach(function(k) {
        if (k !== "default") Object.${DEFINE}(to, k, {
            enumerable: true,
            ${GET}: function() {
                return from[k];
            }
        });
    });
    return from;
}
_exportStar({ a: 1 }, exports);
`;
  const patched = mirrorBabelExportSemantics(code);
  expect(patched).toContain('try { return from[k];');
  const exports = load(patched);
  expect(Object.getOwnPropertyDescriptor(exports, 'a')).toMatchObject({
    configurable: true,
  });
  expect(exports.a).toBe(1);
});

test('throws on an unrecognised direct defineProperty export', () => {
  const unknown = `Object.${DEFINE}(exports, "x", {
    enumerable: true,
    ${GET}() { return 1; }
});`;
  expect(() => mirrorBabelExportSemantics(unknown)).toThrow(
    /did not match any known shape/,
  );
});

test('createTransformer patches sync and async output and salts the cache key', async () => {
  const raw = `${helper}
${exportsBlock(`    ${GET} answer () {
        return answer;
    }`)}
const answer = 1;
`;
  const swc = {
    process: jest.fn(() => ({ code: raw })),
    processAsync: jest.fn(async () => raw),
    getCacheKey: jest.fn(() => 'base'),
  };
  jest.doMock('@swc/jest', () => ({ createTransformer: () => swc }));
  let transformer;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    transformer = require('./swcJestTransformer').createTransformer({});
  });
  jest.dontMock('@swc/jest');
  expect(transformer.process().code).toContain('configurable: true');
  expect(await transformer.processAsync()).toContain('try { return answer;');
  expect(transformer.getCacheKey()).toMatch(
    /^base-babel-export-semantics-v\d+$/,
  );
});
