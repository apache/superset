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
import getCellStyle from '../../src/utils/getCellStyle';

// A standard conditional-formatting rule that paints metric_a red.
const standardCfFormatter = {
  column: 'metric_a',
  getColorFromValue: () => '#ff0000',
  objectFormatting: undefined,
  toTextColor: false,
};

function buildParams(overrides: Record<string, unknown> = {}) {
  return {
    value: 100,
    valueFormatted: '100',
    colDef: { field: 'metric_a' },
    rowIndex: 0,
    node: { rowPinned: undefined, data: {} },
    col: {
      key: 'metric_a',
      metricName: 'metric_a',
      isNumeric: true,
      config: {},
    },
    cellSurfaceColor: '#ffffff',
    hoverCellSurfaceColor: '#eeeeee',
    hasColumnColorFormatters: false,
    columnColorFormatters: [],
    hasBasicColorFormatters: false,
    basicColorFormatters: undefined,
    ...overrides,
  } as unknown as Parameters<typeof getCellStyle>[0];
}

test('applies a standard conditional-format background', () => {
  const style = getCellStyle(
    buildParams({
      hasColumnColorFormatters: true,
      columnColorFormatters: [standardCfFormatter],
    }),
  );
  expect(style.backgroundColor).toBe('#ff0000');
});

test('preserves the standard CF background when the column has no increase/decrease formatter', () => {
  // hasBasicColorFormatters is enabled (e.g. a Green/Red rule exists on another
  // column), but this column has no basic formatter entry. The standard
  // conditional-format background must not be clobbered with undefined.
  const style = getCellStyle(
    buildParams({
      hasColumnColorFormatters: true,
      columnColorFormatters: [standardCfFormatter],
      hasBasicColorFormatters: true,
      basicColorFormatters: [{}], // row 0 has no formatter for metric_a
    }),
  );
  expect(style.backgroundColor).toBe('#ff0000');
});

test('applies the increase/decrease background when the column has one', () => {
  const style = getCellStyle(
    buildParams({
      hasColumnColorFormatters: true,
      columnColorFormatters: [standardCfFormatter],
      hasBasicColorFormatters: true,
      basicColorFormatters: [
        {
          metric_a: {
            backgroundColor: '#00ff00',
            mainArrow: '↑',
            arrowColor: 'green',
          },
        },
      ],
    }),
  );
  expect(style.backgroundColor).toBe('#00ff00');
});

test('does not apply basic formatting to the pinned summary row', () => {
  const style = getCellStyle(
    buildParams({
      node: { rowPinned: 'bottom', data: {} },
      hasBasicColorFormatters: true,
      basicColorFormatters: [
        { metric_a: { backgroundColor: '#00ff00', mainArrow: '↑' } },
      ],
    }),
  );
  expect(style.backgroundColor).toBe('');
});
