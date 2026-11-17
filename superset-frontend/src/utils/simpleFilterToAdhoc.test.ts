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
import {
  BinaryQueryObjectFilterClause,
  TimeGranularity,
} from '@superset-ui/core';
import { simpleFilterToAdhoc } from './simpleFilterToAdhoc';
import buildQuery from '../../plugins/plugin-chart-echarts/src/Sunburst/buildQuery';

// DrillByModal converts chart context-menu filters to adhoc filters before the
// selected chart plugin builds its query.
test('Drill by retains the temporal bucket grain through adhoc form data', () => {
  const bucket: BinaryQueryObjectFilterClause = {
    col: 'order_date',
    op: '==',
    val: 1785542400000,
    grain: TimeGranularity.MONTH,
  };
  const adhoc = simpleFilterToAdhoc(bucket);
  expect(adhoc.timeGrain).toBe(TimeGranularity.MONTH);
  const [query] = buildQuery({
    datasource: '1__table',
    viz_type: 'sunburst_v2',
    columns: ['kind'],
    metric: 'count',
    adhoc_filters: [adhoc],
  }).queries;
  expect(query.filters).toEqual([bucket]);
});

const adhocColumn = {
  expressionType: 'SQL' as const,
  sqlExpression: 'CAST(category AS TEXT)',
  label: 'category',
};

test.each([
  ['', "''"],
  ['00123', "'00123'"],
  [' ', "' '"],
  ['0', '0'],
  ['2024', '2024'],
  ['20.0', '20.0'],
  ['1.50', '1.50'],
  ['1e-05', '1e-05'],
  ['9007199254740993', '9007199254740993'],
  ['+5', "'+5'"],
  ['0x10', "'0x10'"],
  ['NaN', "'NaN'"],
  ['Infinity', "'Infinity'"],
  ["['a']", "'[''a'']'"],
  ["it's text", "'it''s text'"],
])(
  'adhoc drill filters preserve decimal literals and quote other strings %p',
  (val, literal) => {
    expect(simpleFilterToAdhoc({ col: adhocColumn, op: '==', val })).toEqual({
      expressionType: 'SQL',
      clause: 'WHERE',
      sqlExpression: `(CAST(category AS TEXT)) = ${literal}`,
    });
  },
);

test('adhoc multi-value filters format each raw value by type', () => {
  expect(
    simpleFilterToAdhoc({
      col: adhocColumn,
      op: 'IN',
      val: [
        0,
        '00123',
        '',
        null,
        true,
        "it's text",
        '20.0',
        '1.50',
        '1e-05',
        '9007199254740993',
      ],
    }),
  ).toEqual(
    expect.objectContaining({
      sqlExpression:
        "(CAST(category AS TEXT)) IN (0, '00123', '', NULL, TRUE, 'it''s text', 20.0, 1.50, 1e-05, 9007199254740993)",
    }),
  );
});

test.each(['', '00123', 0, null, true])(
  'physical drill filters retain the raw comparator %p',
  val => {
    expect(
      simpleFilterToAdhoc({ col: 'category', op: '==', val }),
    ).toMatchObject({
      expressionType: 'SIMPLE',
      subject: 'category',
      operator: '==',
      comparator: val,
    });
  },
);

test('numeric custom SQL drill filters keep stringified years bare', () => {
  const col = {
    expressionType: 'SQL' as const,
    sqlExpression: 'EXTRACT(YEAR FROM order_date)',
    label: 'year',
  };
  expect(simpleFilterToAdhoc({ col, op: '==', val: '2024' })).toMatchObject({
    expressionType: 'SQL',
    sqlExpression: '(EXTRACT(YEAR FROM order_date)) = 2024',
  });
  expect(simpleFilterToAdhoc({ col, op: 'IN', val: ['2024'] })).toMatchObject({
    expressionType: 'SQL',
    sqlExpression: '(EXTRACT(YEAR FROM order_date)) IN (2024)',
  });
});
