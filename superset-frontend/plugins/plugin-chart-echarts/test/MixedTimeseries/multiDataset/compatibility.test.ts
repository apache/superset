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
import { Dataset } from '@superset-ui/chart-controls';
import {
  checkCompatibility,
  checkTimeGrainSupport,
  Choice,
  getCompatibleXAxisColumns,
  getSharedTimeGrains,
  suggestXAxisColumn,
} from '../../../src/MixedTimeseries/multiDataset/compatibility';

const dataset = (
  columns: { column_name: string; is_dttm?: boolean }[],
): Pick<Dataset, 'columns'> => ({ columns }) as Pick<Dataset, 'columns'>;

const datasetA = dataset([
  { column_name: 'ds', is_dttm: true },
  { column_name: 'region', is_dttm: false },
]);
const datasetB = dataset([
  { column_name: 'order_date', is_dttm: true },
  { column_name: 'country', is_dttm: false },
]);

const formData = (xAxis: string, xAxisB: unknown) =>
  ({ x_axis: xAxis, x_axis_b: xAxisB }) as unknown as QueryFormData;

test('two temporal axes are compatible', () => {
  expect(
    checkCompatibility(datasetA, datasetB, formData('ds', 'order_date')),
  ).toEqual([]);
});

test('two categorical axes are compatible', () => {
  expect(
    checkCompatibility(datasetA, datasetB, formData('region', 'country')),
  ).toEqual([]);
});

test('a missing Dataset B column is reported', () => {
  expect(
    checkCompatibility(datasetA, datasetB, formData('ds', 'nope')),
  ).toEqual(['Column "nope" was not found in Dataset B.']);
});

test('temporal A with categorical B is reported', () => {
  expect(
    checkCompatibility(datasetA, datasetB, formData('ds', 'country')),
  ).toEqual([
    'The X-axis of Query A is temporal but "country" in Dataset B is not.',
  ]);
});

test('categorical A with temporal B is reported', () => {
  expect(
    checkCompatibility(datasetA, datasetB, formData('region', 'order_date')),
  ).toEqual([
    'The X-axis of Query B ("order_date") is temporal but "region" in Dataset A is not.',
  ]);
});

test('ad-hoc X-axes carry no column metadata and are not flagged', () => {
  const adhoc = { sqlExpression: 'DATE(x)', label: 'x', expressionType: 'SQL' };
  expect(checkCompatibility(datasetA, datasetB, formData('ds', adhoc))).toEqual(
    [],
  );
});

test('datasets without columns do not throw', () => {
  expect(
    checkCompatibility(
      {} as Pick<Dataset, 'columns'>,
      {} as Pick<Dataset, 'columns'>,
      formData('ds', 'order_date'),
    ),
  ).toEqual(['Column "order_date" was not found in Dataset B.']);
});

/* --------------------------------------------------------------------------
 * X-axis candidates, suggestion and shared time grains
 * ------------------------------------------------------------------------ */

type TestColumn = {
  column_name: string;
  is_dttm?: boolean;
  groupby?: boolean;
  type_generic?: number;
};

const typedDataset = (
  columns: TestColumn[],
  extra: Record<string, unknown> = {},
) => ({ columns, ...extra }) as unknown as Dataset;

// GenericDataType: Numeric = 0, String = 1, Temporal = 2
const typedA = typedDataset([
  { column_name: 'ds', is_dttm: true, groupby: true, type_generic: 2 },
  { column_name: 'gender', groupby: true, type_generic: 1 },
  { column_name: 'age', groupby: true, type_generic: 0 },
]);
const typedB = typedDataset(
  [
    { column_name: 'created', is_dttm: true, groupby: true, type_generic: 2 },
    {
      column_name: 'order_date',
      is_dttm: true,
      groupby: true,
      type_generic: 2,
    },
    { column_name: 'country', groupby: true, type_generic: 1 },
    { column_name: 'gender', groupby: true, type_generic: 1 },
    { column_name: 'amount', groupby: true, type_generic: 0 },
    { column_name: 'hidden', groupby: false, type_generic: 1 },
  ],
  { main_dttm_col: 'order_date' },
);

const names = (columns: { column_name: string }[]) =>
  columns.map(column => column.column_name);

test('temporal X-axis offers only Dataset B time columns', () => {
  expect(names(getCompatibleXAxisColumns(typedA, typedB, 'ds'))).toEqual([
    'created',
    'order_date',
  ]);
});

test('categorical X-axis offers same-type columns, same name first', () => {
  expect(names(getCompatibleXAxisColumns(typedA, typedB, 'gender'))).toEqual([
    'gender',
    'country',
  ]);
  expect(names(getCompatibleXAxisColumns(typedA, typedB, 'age'))).toEqual([
    'amount',
  ]);
});

test('no X-axis on Query A offers every groupable Dataset B column', () => {
  expect(names(getCompatibleXAxisColumns(typedA, typedB, undefined))).toEqual([
    'created',
    'order_date',
    'country',
    'gender',
    'amount',
  ]);
});

test('suggestion prefers the same name, then the main time column', () => {
  expect(suggestXAxisColumn(typedA, typedB, 'gender')).toBe('gender');
  expect(suggestXAxisColumn(typedA, typedB, 'ds')).toBe('order_date');
  // No guess for a categorical axis without a same-named column.
  expect(suggestXAxisColumn(typedA, typedB, 'age')).toBeNull();
  expect(suggestXAxisColumn(typedA, typedB, undefined)).toBeNull();
});

test('categorical X-axes with different data types are reported', () => {
  expect(
    checkCompatibility(
      typedA,
      typedB,
      formData('age', 'country') as QueryFormData,
    ),
  ).toEqual([
    'The X-axis columns "age" in Dataset A and "country" in Dataset B have different data types, so their values cannot line up.',
  ]);
});

const grainChoices: Choice[] = [
  ['P1D', 'Day'],
  ['P1W', 'Week'],
  ['1969-12-29T00:00:00Z/P1W', 'Week starting Monday'],
  ['P1M', 'Month'],
];

test('time grains are narrowed to those both datasets support', () => {
  const datasetBGrains = typedDataset([], {
    time_grain_sqla: [
      ['P1M', 'Month'],
      ['P1D', 'Day'],
    ],
  });
  expect(getSharedTimeGrains(grainChoices, datasetBGrains)).toEqual([
    ['P1D', 'Day'],
    ['P1M', 'Month'],
  ]);
});

test('time grains are unchanged when Dataset B reports none', () => {
  expect(getSharedTimeGrains(grainChoices, typedDataset([]))).toBe(
    grainChoices,
  );
});

test('an unsupported time grain is reported', () => {
  const datasetBGrains = typedDataset([], {
    time_grain_sqla: [['P1D', 'Day']],
  });
  expect(checkTimeGrainSupport(datasetBGrains, 'P1D')).toEqual([]);
  expect(checkTimeGrainSupport(datasetBGrains, 'P1W', 'Week')).toEqual([
    'The database of Dataset B does not support the time grain "Week". Pick a time grain that both datasets support.',
  ]);
  expect(checkTimeGrainSupport(typedDataset([]), 'P1W')).toEqual([]);
});
