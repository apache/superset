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
import { decimalParts, isNumericText, sortResults } from './sortResults';

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

// The regular expressions these parsers replaced, kept as a reference oracle.
const LEGACY_DECIMAL =
  /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/;
const LEGACY_NUMERIC = /^(NaN|-?((\d*\.\d+|\d+)([Ee][+-]?\d+)?|Infinity))$/;

function strings(alphabet: string[], maxLength: number): string[] {
  const all = [''];
  let level = [''];
  for (let length = 1; length <= maxLength; length += 1) {
    level = level.flatMap(prefix => alphabet.map(token => prefix + token));
    all.push(...level);
  }
  return all;
}

test('linear parsers accept exactly what the legacy regexes matched', () => {
  const alphabet = ['0', '7', '.', 'e', 'E', '+', '-', 'x', 'NaN', 'Infinity'];
  const mismatches: string[] = [];
  let checked = 0;
  strings(alphabet, 5).forEach(text => {
    if ((decimalParts(text) !== null) !== LEGACY_DECIMAL.test(text)) {
      mismatches.push(`decimal: ${text}`);
    }
    if (isNumericText(text) !== LEGACY_NUMERIC.test(text)) {
      mismatches.push(`numeric: ${text}`);
    }
    checked += 1;
  });
  expect(mismatches).toEqual([]);
  expect(checked).toBeGreaterThan(100000);
});

test('parses adversarial near-miss inputs in linear time', () => {
  const inputs = [
    `${'1'.repeat(200000)}x`,
    `.${'1'.repeat(200000)}.`,
    `1e${'1'.repeat(200000)}e`,
    `-${'1'.repeat(100000)}.${'1'.repeat(100000)}E+`,
  ];
  const started = Date.now();
  inputs.forEach(text => {
    expect(decimalParts(text)).toBeNull();
    expect(isNumericText(text)).toBe(false);
  });
  expect(Date.now() - started).toBeLessThan(1000);
});
