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
import { decimalParts, getCachedSortKey, sortResults } from './sortResults';

test.each([
  ['2', '10', -1],
  [
    '12345678901234567890.123456789012345678',
    '12345678901234567890.123456789012345679',
    -1,
  ],
  [
    '-12345678901234567890.123456789012345678',
    '-12345678901234567890.123456789012345679',
    1,
  ],
  ['1E-18', '0.000000000000000002', -1],
  ['1E+100000', '9E+99999', 1],
  ['1E-100000', '9E-100001', 1],
  ['0.00000000000000000001', '0', 1],
  ['0010.500', 10.5, 0],
  ['-0.00', 0, 0],
  ['.5', '0.50', 0],
  ['9.99', 10, -1],
  [null, '1.23', 1],
  ['1.23', null, -1],
  [null, null, 0],
  ['apple', 'pear', -1],
  ['2024-01-01', '2025-01-01', -1],
  ['-Infinity', '-1.2', -1],
  ['Infinity', '1.2', 1],
] as const)('sorts %s vs %s exactly', (a, b, expected) => {
  expect(sortResults(a, b)).toBe(expected);
});

test.each([
  ['apple', 5],
  ['apple', 'NaN'],
  [NaN, 1.5],
  ['2024-01-01', 7],
] as const)('orders %s against %s in one direction only', (a, b) => {
  expect(sortResults(a, b)).toBe(-sortResults(b, a));
});

test('treats two NaNs as equal rather than unordered', () => {
  expect(sortResults(NaN, NaN)).toBe(0);
  expect(sortResults('NaN', 'NaN')).toBe(0);
});

test('sorts a mixed text and number column transitively', () => {
  const column = [5, 'apple', 'NaN', 10, 'banana'];
  const ascending = [...column].sort(sortResults);
  const descending = [...column].reverse().sort(sortResults);
  expect(descending).toEqual(ascending);
});

test.each([
  [[9, '5x', 10]],
  [[10, 9, '5x']],
  [['5x', 10, 9]],
  [['9', '5x', '10']],
  [['10', '9', '5x']],
  [['5x', '10', '9']],
])('sorts numbers before text whatever the input order: %p', column => {
  const sorted = [...column].sort(sortResults).map(String);
  expect(sorted).toEqual(['9', '10', '5x']);
});

test('orders numbers, then text, then NaN, then nulls', () => {
  const column = [
    'NaN',
    null,
    'apple',
    3,
    NaN,
    '2.5',
    'Infinity',
    '-Infinity',
    -Infinity,
    '10',
  ];
  expect([...column].sort(sortResults)).toEqual([
    '-Infinity',
    -Infinity,
    '2.5',
    3,
    '10',
    'Infinity',
    'apple',
    'NaN',
    NaN,
    null,
  ]);
});

test('is a consistent total order over mixed values', () => {
  const values = [
    null,
    NaN,
    'NaN',
    -Infinity,
    '-Infinity',
    Infinity,
    'Infinity',
    -1.5,
    '-1.50',
    0,
    -0,
    '0.000',
    '1E-18',
    0.1,
    '0.1',
    9,
    '10',
    1e21,
    '1E+21',
    '',
    '5x',
    'apple',
    '2024-01-01',
  ];
  const sign = (n: number) => Math.sign(n) || 0;
  values.forEach(a => {
    expect(sortResults(a, a)).toBe(0);
    values.forEach(b => {
      const ab = sign(sortResults(a, b));
      expect(sign(sortResults(b, a))).toBe(-ab || 0);
      values.forEach(c => {
        const bc = sign(sortResults(b, c));
        if (ab <= 0 && bc <= 0) {
          expect(sign(sortResults(a, c))).toBeLessThanOrEqual(0);
        }
      });
    });
  });
});

test.each([
  [1, 2, -1],
  [2, 1, 1],
  [-0, 0, 0],
  [-Infinity, -1e308, -1],
  [Infinity, 1e308, 1],
  [9007199254740993, 9007199254740992, 0],
  [0.1 + 0.2, 0.3, 1],
] as const)('compares plain numbers %p vs %p directly', (a, b, expected) => {
  expect(sortResults(a, b)).toBe(expected);
});

test.each([
  [0.1, '0.1'],
  [1e21, '1E+21'],
  [1e-7, '0.0000001'],
  [-2.5, '-2.50'],
  [Infinity, 'Infinity'],
])('orders number %p and its exact string %p equally', (number, text) => {
  expect(sortResults(number, text)).toBe(0);
  expect(sortResults(text, number)).toBe(0);
});

// Reference regex the linear parser must agree with.
const REFERENCE_DECIMAL =
  /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/;

function strings(alphabet: string[], maxLength: number): string[] {
  const all = [''];
  let level = [''];
  for (let length = 1; length <= maxLength; length += 1) {
    level = level.flatMap(prefix => alphabet.map(token => prefix + token));
    level.forEach(text => all.push(text));
  }
  return all;
}

test('linear parser accepts exactly what the reference regex matches', () => {
  const alphabet = ['0', '7', '.', 'e', 'E', '+', '-', 'x', 'NaN', 'Infinity'];
  const mismatches: string[] = [];
  const inputs = strings(alphabet, 5);
  expect(inputs).toHaveLength(111111);
  expect(inputs).toEqual(
    expect.arrayContaining(['NaN', 'Infinity', '-Infinity']),
  );
  inputs.forEach(text => {
    if ((decimalParts(text) !== null) !== REFERENCE_DECIMAL.test(text)) {
      mismatches.push(`decimal: ${text}`);
    }
  });
  expect(mismatches).toEqual([]);
});

test('rejects long adversarial near-miss inputs', () => {
  const inputs = [
    `${'1'.repeat(200000)}x`,
    `.${'1'.repeat(200000)}.`,
    `1e${'1'.repeat(200000)}e`,
    `-${'1'.repeat(100000)}.${'1'.repeat(100000)}E+`,
  ];
  inputs.forEach(text => {
    expect(decimalParts(text)).toBeNull();
  });
});

test('reuses sort keys only within the same result set', () => {
  const rows = [{ value: '1.25' }, { value: '2.50' }];
  expect(getCachedSortKey('1.25', rows)).toBeUndefined();
  expect(sortResults('1.25', '2.50', rows)).toBe(-1);
  const firstKey = getCachedSortKey('1.25', rows);
  const secondKey = getCachedSortKey('2.50', rows);
  expect(firstKey).toBeDefined();
  expect(secondKey).toBeDefined();
  expect(sortResults('2.50', '1.25', rows)).toBe(1);
  expect(getCachedSortKey('1.25', rows)).toBe(firstKey);
  expect(getCachedSortKey('2.50', rows)).toBe(secondKey);

  const otherRows = [...rows];
  expect(getCachedSortKey('1.25', otherRows)).toBeUndefined();
  expect(sortResults('1.25', '2.50', otherRows)).toBe(-1);
  expect(getCachedSortKey('1.25', otherRows)).toEqual(firstKey);
  expect(getCachedSortKey('1.25', otherRows)).not.toBe(firstKey);
  expect(sortResults('1.25', '2.50')).toBe(-1);
  expect(getCachedSortKey('1.25', rows)).toBe(firstKey);
});
