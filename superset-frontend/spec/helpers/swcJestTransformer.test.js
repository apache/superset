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

const NAMED_EXPORTS = `"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get answer () {
        return answer;
    }
});
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
  // The getter keyword is interpolated so this fixture is not itself rewritten
  // when the test file goes through the transformer.
  const changed = `${NAMED_EXPORTS.split('_export(exports')[0]}_export(exports, {
    ${'get'} answer() { return answer; }
});
const answer = 42;`;
  expect(() => mirrorBabelExportSemantics(changed)).toThrow(
    /named export getters did not match/,
  );
});
