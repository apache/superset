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
import type { QueryFormMetric } from '@superset-ui/core';
import { xAxisSortControl } from '../../src/shared-controls/customControls';
import { SORT_SERIES_CHOICES } from '../../src/constants';
import { SortSeriesType } from '../../src/types';
import type {
  ControlPanelState,
  ControlState,
  ControlStateMapping,
  Dataset,
} from '../../src/types';

const naSales: QueryFormMetric = {
  expressionType: 'SIMPLE',
  aggregate: 'SUM',
  column: { column_name: 'na_sales' },
  label: 'SUM(na_sales)',
};

const dataset = {
  id: 1,
  type: 'table',
  columns: [
    { column_name: 'genre', type: 'STRING' },
    { column_name: 'platform', type: 'STRING' },
    { column_name: 'na_sales', type: 'FLOAT' },
    { column_name: 'sum', type: 'STRING' },
  ],
  metrics: [{ metric_name: 'count', expression: 'COUNT(*)' }],
  verbose_map: {
    genre: 'Genre',
    count: 'Count',
    'SUM(na_sales)': 'NA Sales',
  },
} as unknown as Dataset;

const aggregateOptions = SORT_SERIES_CHOICES.map(([value, label]) => ({
  value,
  label,
}));

function mapStateToProps(
  controlValues: Record<string, unknown>,
  value?: string,
) {
  const controls = Object.fromEntries(
    Object.entries(controlValues).map(([name, controlValue]) => [
      name,
      { value: controlValue },
    ]),
  );
  const state = {
    controls: {
      ...controls,
      datasource: { datasource: dataset },
    } as unknown as ControlStateMapping,
    datasource: dataset,
  } as unknown as ControlPanelState;
  const controlState = {
    value,
    type: 'XAxisSortControl',
  } as unknown as ControlState;
  return xAxisSortControl.config.mapStateToProps(state, controlState);
}

const singleSeriesControls = {
  x_axis: 'genre',
  metrics: ['count'],
  timeseries_limit_metric: naSales,
  groupby: [],
};

const fieldOptions = [
  { value: 'genre', label: 'Genre' },
  { value: 'count', label: 'Count' },
  { value: 'SUM(na_sales)', label: 'NA Sales' },
];

test('offers the x-axis column and every metric with verbose labels when there are no dimensions', () => {
  expect(mapStateToProps(singleSeriesControls).options).toEqual(fieldOptions);
});

test('keeps the same field options and adds the series aggregates when a dimension is set', () => {
  expect(
    mapStateToProps({ ...singleSeriesControls, groupby: ['platform'] }).options,
  ).toEqual([...fieldOptions, ...aggregateOptions]);
});

test('adds the series aggregates when there are several metrics and no dimension', () => {
  expect(
    mapStateToProps({ ...singleSeriesControls, metrics: ['count', naSales] })
      .options,
  ).toEqual([...fieldOptions, ...aggregateOptions]);
});

test('drops a field whose label collides with a series aggregate value', () => {
  const { options } = mapStateToProps({
    ...singleSeriesControls,
    x_axis: 'sum',
    groupby: ['platform'],
  });
  expect(options.filter(option => option.value === 'sum')).toEqual([
    { value: SortSeriesType.Sum, label: 'Total value' },
  ]);
});

test('offers a field named like a series aggregate when there is nothing to collide with', () => {
  const { options } = mapStateToProps({
    ...singleSeriesControls,
    x_axis: 'sum',
  });
  expect(options.filter(option => option.value === 'sum')).toEqual([
    { value: 'sum', label: 'sum' },
  ]);
});

test('keeps a metric selection when a dimension is added', () => {
  const { shouldReset } = mapStateToProps(
    { ...singleSeriesControls, groupby: ['platform'] },
    'SUM(na_sales)',
  );
  expect(shouldReset).toBe(false);
});

test('keeps a series aggregate selection when a dimension is set', () => {
  const { shouldReset } = mapStateToProps(
    { ...singleSeriesControls, groupby: ['platform'] },
    SortSeriesType.Max,
  );
  expect(shouldReset).toBe(false);
});

test('resets a series aggregate selection once the dimension is removed', () => {
  const { shouldReset } = mapStateToProps(
    singleSeriesControls,
    SortSeriesType.Max,
  );
  expect(shouldReset).toBe(true);
});

test('resets a selection that is no longer offered', () => {
  const { shouldReset } = mapStateToProps(singleSeriesControls, 'platform');
  expect(shouldReset).toBe(true);
});
