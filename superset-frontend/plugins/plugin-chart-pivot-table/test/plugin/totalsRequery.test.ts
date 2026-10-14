/*
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
import { QueryFormMetric, QueryObject } from '@superset-ui/core';
import buildQuery from '../../src/plugin/buildQuery';
import controlPanel from '../../src/plugin/controlPanel';
import buildGroupbyCombinations from '../../src/plugin/utilities';
import { MetricsLayoutEnum, PivotTableQueryFormData } from '../../src/types';

type GroupingSetsQuery = QueryObject & { grouping_sets: string[][] };

// Non-additive metrics (AVG) make totals/subtotals database-computed rollup
// levels, so which levels are queried must follow the Options toggles.
const metrics = [
  {
    expressionType: 'SIMPLE',
    aggregate: 'SUM',
    column: { column_name: 'sales' },
    label: 'sum_sales',
  },
  {
    expressionType: 'SIMPLE',
    aggregate: 'AVG',
    column: { column_name: 'sales' },
    label: 'avg_sales',
  },
] as QueryFormMetric[];

const noOptions = {
  groupbyRows: ['territory'],
  groupbyColumns: ['quarter'],
  metrics,
  metricsLayout: MetricsLayoutEnum.ROWS,
  transposePivot: false,
  combineMetric: false,
  rowTotals: false,
  rowSubTotals: false,
  colTotals: false,
  colSubTotals: false,
  datasource: '5__table',
  viz_type: 'pivot_table_v2',
} as unknown as PivotTableQueryFormData;

function findControlConfig(name: string) {
  const control = controlPanel.controlPanelSections
    .flatMap(section => section?.controlSetRows ?? [])
    .flat()
    .find(
      item =>
        item !== null &&
        typeof item === 'object' &&
        'name' in item &&
        item.name === name,
    );
  if (!control || typeof control === 'string' || !('config' in control)) {
    throw new Error(`Control ${name} is missing`);
  }
  return control.config;
}

// Totals and subtotals come from rollup levels fetched by the query. A
// renderTrigger control re-renders the chart from the stored result without
// querying, so its toggle can never add a level the stored result lacks.
test.each(['rowTotals', 'rowSubTotals', 'colTotals', 'colSubTotals'])(
  '%s is not a renderTrigger control, so toggling it re-queries',
  name => {
    expect(findControlConfig(name).renderTrigger).toBeFalsy();
  },
);

// With metrics on rows, the renderer's row hierarchy is [metric, ...rowDims],
// so the level with every row dimension collapsed is the per-metric group
// subtotal, not only the bottom Total row.
test('rowSubTotals alone requests the per-metric subtotal level (metrics on rows)', () => {
  const levels = buildGroupbyCombinations({
    ...noOptions,
    rowSubTotals: true,
  });
  expect(levels).toContainEqual({ rows: [], columns: ['quarter'] });
});

// Mirror image for metrics on columns: the column hierarchy is
// [metric, ...columnDims].
test('colSubTotals alone requests the per-metric subtotal level (metrics on columns)', () => {
  const levels = buildGroupbyCombinations({
    ...noOptions,
    metricsLayout: MetricsLayoutEnum.COLUMNS,
    colSubTotals: true,
  });
  expect(levels).toContainEqual({ rows: ['territory'], columns: [] });
});

test('rowSubTotals alone changes the query, so it cannot share the no-options cache entry', () => {
  const groupingSets = (formData: PivotTableQueryFormData) =>
    (buildQuery(formData).queries[0] as GroupingSetsQuery).grouping_sets;

  const withRowSubTotals = groupingSets({ ...noOptions, rowSubTotals: true });

  expect(withRowSubTotals).not.toEqual(groupingSets(noOptions));
  expect(withRowSubTotals).toContainEqual(['quarter']);
});
