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
import { QueryFormData, TimeGranularity } from '@superset-ui/core';
import buildQuery from '../../../src/MixedTimeseries/buildQuery';
import {
  isMultiDatasetMode,
  MixedTimeseriesRequestPlanner,
} from '../../../src/MixedTimeseries/multiDataset/planner';
import { MultiDatasetValidationError } from '../../../src/MixedTimeseries/multiDataset/types';

const baseFormData = {
  datasource: '25__table',
  viz_type: 'mixed_timeseries',
  time_range: '1980 : 2000',
  time_grain_sqla: TimeGranularity.WEEK,
  x_axis: 'ds',
  metrics: ['sum(sales)'],
  groupby: [],
  use_secondary_dataset: true,
  datasource_b: '42__table',
  x_axis_b: 'order_date',
  metrics_b: ['sum(spend)'],
  groupby_b: [],
} as unknown as QueryFormData;

test('isMultiDatasetMode requires the switch and a Dataset B', () => {
  expect(isMultiDatasetMode(baseFormData)).toBe(true);
  expect(
    isMultiDatasetMode({
      ...baseFormData,
      use_secondary_dataset: false,
    } as QueryFormData),
  ).toBe(false);
  expect(
    isMultiDatasetMode({ ...baseFormData, datasource_b: '' } as QueryFormData),
  ).toBe(false);
  expect(
    isMultiDatasetMode({
      ...baseFormData,
      datasource_b: undefined,
    } as QueryFormData),
  ).toBe(false);
});

test('validate passes for a complete configuration', () => {
  expect(() =>
    new MixedTimeseriesRequestPlanner(baseFormData).validate(),
  ).not.toThrow();
});

test('validate reports every missing field at once', () => {
  const planner = new MixedTimeseriesRequestPlanner({
    ...baseFormData,
    datasource: '',
    datasource_b: undefined,
    x_axis: undefined,
    x_axis_b: '',
  } as unknown as QueryFormData);

  let thrown: unknown;
  try {
    planner.validate();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(MultiDatasetValidationError);
  expect((thrown as MultiDatasetValidationError).errors).toEqual([
    'Select Dataset A',
    'Select Dataset B',
    'Select an X-axis for Query A',
    'Select an X-axis for Query B',
  ]);
});

test('validate flags only the missing Query B X-axis', () => {
  const planner = new MixedTimeseriesRequestPlanner({
    ...baseFormData,
    x_axis_b: undefined,
  } as unknown as QueryFormData);
  expect(() => planner.validate()).toThrow('Select an X-axis for Query B');
});

test('requests are stamped with their target and keep the rest intact', () => {
  const planner = new MixedTimeseriesRequestPlanner(baseFormData);
  expect(planner.buildRequestA()).toEqual({
    ...baseFormData,
    _mixed_target: 'A',
  });
  expect(planner.buildRequestB()).toEqual({
    ...baseFormData,
    _mixed_target: 'B',
  });
});

test('the planner does not mutate the form data', () => {
  const snapshot = JSON.parse(JSON.stringify(baseFormData));
  const planner = new MixedTimeseriesRequestPlanner(baseFormData);
  planner.buildRequestA();
  planner.buildRequestB();
  expect(baseFormData).toEqual(snapshot);
});

test('planned requests feed buildQuery one dataset each', () => {
  const planner = new MixedTimeseriesRequestPlanner(baseFormData);
  const contextA = buildQuery(planner.buildRequestA());
  const contextB = buildQuery(planner.buildRequestB());

  expect(contextA.datasource).toEqual({ id: 25, type: 'table' });
  expect(contextA.queries).toHaveLength(1);
  expect(contextA.queries[0].metrics).toEqual(['sum(sales)']);

  expect(contextB.datasource).toEqual({ id: 42, type: 'table' });
  expect(contextB.queries).toHaveLength(1);
  expect(contextB.queries[0].metrics).toEqual(['sum(spend)']);
  expect(contextB.queries[0].columns?.[0]).toMatchObject({
    columnType: 'BASE_AXIS',
    sqlExpression: 'order_date',
    timeGrain: TimeGranularity.WEEK,
  });
});
