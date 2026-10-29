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
import { QueryFormData } from '@superset-ui/core';
import buildQuery from '../../src/Sunburst/buildQuery';

// Form data as Explore saves it: the grain lives in the Sunburst time grain
// control and the hidden temporal lookup marks which levels are temporal.
const exploreSaved = {
  datasource: '1__table',
  viz_type: 'sunburst_v2',
  columns: ['ts', 'region'],
  metric: 'count',
  temporal_columns_lookup: { ts: true },
  time_grain_sqla: 'P1M',
} as unknown as QueryFormData;

const groupedTs = (timeGrain: string) => ({
  timeGrain,
  columnType: 'BASE_AXIS',
  sqlExpression: 'ts',
  label: 'ts',
  expressionType: 'SQL',
  isColumnReference: true,
});

test('the saved grain applies only to temporal hierarchy levels', () => {
  const [query] = buildQuery({
    ...exploreSaved,
    sort_by_metric: true,
  } as QueryFormData).queries;
  expect(query.columns).toEqual([groupedTs('P1M'), 'region']);
  expect(query.extras?.time_grain_sqla).toBe('P1M');
  expect(query.orderby).toEqual([['count', false]]);
});

test('a dashboard Time Grain filter overrides the saved grain', () => {
  const [query] = buildQuery({
    ...exploreSaved,
    extra_form_data: { time_grain_sqla: 'P1Y' },
  } as QueryFormData).queries;
  expect(query.columns).toEqual([groupedTs('P1Y'), 'region']);
  expect(query.extras?.time_grain_sqla).toBe('P1Y');
});

test('a chart saved without a grain stays raw until a dashboard Time Grain filter applies', () => {
  const { time_grain_sqla: _grain, ...saved } = exploreSaved;
  const [raw] = buildQuery(saved as QueryFormData).queries;
  expect(raw.columns).toEqual(['ts', 'region']);
  expect(raw.extras?.time_grain_sqla).toBeUndefined();

  const [query] = buildQuery({
    ...saved,
    extra_form_data: { time_grain_sqla: 'P1W' },
  } as QueryFormData).queries;
  expect(query.columns).toEqual([groupedTs('P1W'), 'region']);
});

test('non-temporal levels drop a dormant grain instead of sending it', () => {
  const [query] = buildQuery({
    ...exploreSaved,
    columns: ['region', 'country'],
    temporal_columns_lookup: { ts: true, region: false },
  } as QueryFormData).queries;
  expect(query.columns).toEqual(['region', 'country']);
  // Semantic views reject a grain that has no time column to apply to.
  expect(query.extras).not.toHaveProperty('time_grain_sqla');
});

test('the MCP legacy granularity subject still selects the grained level', () => {
  const [query] = buildQuery({
    datasource: '1__table',
    viz_type: 'sunburst_v2',
    columns: ['ts', 'region'],
    metric: 'count',
    granularity_sqla: 'ts',
    time_grain_sqla: 'P1M',
  } as unknown as QueryFormData).queries;
  expect(query.columns).toEqual([groupedTs('P1M'), 'region']);
  expect(query.granularity).toBe('ts');
});

test('semantic views get a column reference and cross-filter columns stay names', () => {
  const formData = {
    ...exploreSaved,
    datasource: '7__semantic_view',
  } as QueryFormData;
  const [query] = buildQuery(formData).queries;
  expect(query.columns?.[0]).toMatchObject({
    isColumnReference: true,
    sqlExpression: 'ts',
    timeGrain: 'P1M',
  });
  // EchartsSunburst builds cross-filter `col` from formData.columns, which
  // buildQuery leaves as plain names, so the semantic filter validator sees a
  // dimension name rather than a column object.
  expect(formData.columns).toEqual(['ts', 'region']);
});

test('Explore metadata grains both temporal levels alongside the legacy MCP subject', () => {
  const saved = {
    ...exploreSaved,
    columns: ['ts', 'ship_date'],
    granularity_sqla: 'ts',
    temporal_columns_lookup: undefined,
  } as QueryFormData;
  const [dashboard] = buildQuery(saved).queries;
  const [explore] = buildQuery({
    ...saved,
    temporal_columns_lookup: { ts: true, ship_date: true },
  } as QueryFormData).queries;
  expect(dashboard.columns).toEqual([groupedTs('P1M'), 'ship_date']);
  expect(explore.columns).toEqual([
    groupedTs('P1M'),
    { ...groupedTs('P1M'), sqlExpression: 'ship_date', label: 'ship_date' },
  ]);
});

test('a dashboard Time Column override does not ungrain other temporal levels', () => {
  const [query] = buildQuery({
    ...exploreSaved,
    columns: ['ts', 'ship_date'],
    granularity_sqla: 'ts',
    temporal_columns_lookup: { ts: true, ship_date: true },
    extra_form_data: { granularity_sqla: 'ship_date' },
  } as QueryFormData).queries;
  expect(query.columns).toEqual([
    groupedTs('P1M'),
    { ...groupedTs('P1M'), sqlExpression: 'ship_date', label: 'ship_date' },
  ]);
});

test('a Time Column outside the hierarchy does not disable lookup-marked grains', () => {
  const formData = {
    ...exploreSaved,
    granularity_sqla: 'ship_date',
  } as QueryFormData;
  const [withLookup] = buildQuery(formData).queries;
  const [withoutLookup] = buildQuery({
    ...formData,
    temporal_columns_lookup: undefined,
  } as QueryFormData).queries;
  expect(withLookup.columns).toEqual([groupedTs('P1M'), 'region']);
  expect(withoutLookup.columns).toEqual(['ts', 'region']);
});

test.each([undefined, null, {}])(
  'a legacy semantic Sunburst retains a dashboard grain unless metadata rules it out: %p',
  temporalLookup => {
    const [query] = buildQuery({
      datasource: '7__semantic_view',
      viz_type: 'sunburst_v2',
      columns: ['order_date', 'category'],
      metric: 'total_sales',
      temporal_columns_lookup: temporalLookup,
      extra_form_data: { time_grain_sqla: 'P1M' },
    } as unknown as QueryFormData).queries;
    expect(query.columns).toEqual(['order_date', 'category']);
    if (temporalLookup == null) {
      expect(query.extras?.time_grain_sqla).toBe('P1M');
    } else {
      expect(query.extras).not.toHaveProperty('time_grain_sqla');
    }
  },
);
