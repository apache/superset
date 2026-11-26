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
import { checkCompatibility } from '../../../src/MixedTimeseries/multiDataset/compatibility';

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
