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
import getRowBasicColorFormatter, {
  RowFormatters,
} from '../../src/utils/getRowBasicColorFormatter';
import { BASIC_COLOR_FORMATTERS_ROW_KEY } from '../../src/consts';

const red: RowFormatters = {
  sales: { backgroundColor: 'red', mainArrow: '↓', arrowColor: 'red' },
};
const green: RowFormatters = {
  sales: { backgroundColor: 'green', mainArrow: '↑', arrowColor: 'green' },
};

// Positional array in the original (unsorted) query order: row 0 -> green, row 1 -> red.
const positional: RowFormatters[] = [green, red];

test('uses the formatter attached to the row, not the displayed rowIndex (#105973)', () => {
  // After sorting, the row whose original formatter is `red` is displayed first
  // (rowIndex 0). The positional lookup would wrongly return `green`.
  const rowData: Record<string | symbol, unknown> = { sales: 5 };
  rowData[BASIC_COLOR_FORMATTERS_ROW_KEY] = red;
  const node = { data: rowData };

  expect(getRowBasicColorFormatter(node, 0, positional)).toBe(red);
  expect(
    getRowBasicColorFormatter(node, 0, positional)?.sales.backgroundColor,
  ).toBe('red');
});

test('falls back to positional lookup when no formatter is attached', () => {
  const node = { data: { sales: 5 } };
  expect(getRowBasicColorFormatter(node, 1, positional)).toBe(red);
});

test('returns undefined when nothing matches', () => {
  expect(
    getRowBasicColorFormatter(undefined, null, positional),
  ).toBeUndefined();
  expect(
    getRowBasicColorFormatter({ data: {} }, null, positional),
  ).toBeUndefined();
});

test('attached formatter is a Symbol so it does not leak into the row', () => {
  const rowData: Record<string | symbol, unknown> = { sales: 5 };
  rowData[BASIC_COLOR_FORMATTERS_ROW_KEY] = green;
  // Symbol keys are excluded from Object.keys, JSON serialization and spreads.
  expect(Object.keys(rowData)).toEqual(['sales']);
  expect(JSON.stringify(rowData)).toBe('{"sales":5}');
});

test('does not collide with a real column named "__basicColorFormatters__"', () => {
  // The old string key would have overwritten this user column; the Symbol key
  // leaves it untouched while still resolving the attached formatter (#105973).
  const rowData: Record<string | symbol, unknown> = {
    sales: 5,
    __basicColorFormatters__: 'user data',
  };
  rowData[BASIC_COLOR_FORMATTERS_ROW_KEY] = red;
  const node = { data: rowData };

  expect(node.data.__basicColorFormatters__).toBe('user data');
  expect(getRowBasicColorFormatter(node, 0, positional)).toBe(red);
});
