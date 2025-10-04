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
  ComparisonType,
  QueryObject,
  SqlaFormData,
  VizType,
} from '@superset-ui/core';
import { renameOperator } from '@superset-ui/chart-controls';

const formData: SqlaFormData = {
  x_axis: 'dttm',
  metrics: ['count(*)'],
  groupby: ['gender'],
  time_range: '2015 : 2016',
  granularity: 'month',
  datasource: 'foo',
  viz_type: VizType.Table,
  truncate_metric: true,
};
const queryObject: QueryObject = {
  is_timeseries: true,
  metrics: ['count(*)'],
  columns: ['gender', 'dttm'],
  time_range: '2015 : 2016',
  granularity: 'month',
  post_processing: [],
};

test('should skip renameOperator for empty metrics', () => {
  expect(
    renameOperator(formData, {
      ...queryObject,
      ...{
        metrics: [],
      },
    }),
  ).toEqual(undefined);
});

test('should skip renameOperator if series does not exist', () => {
  expect(
    renameOperator(formData, {
      ...queryObject,
      ...{
        columns: [],
      },
    }),
  ).toEqual(undefined);
});

test('should skip renameOperator if series does not exist and a single time shift exists', () => {
  expect(
    renameOperator(
      { ...formData, ...{ time_compare: ['1 year ago'] } },
      {
        ...queryObject,
        ...{
          columns: [],
        },
      },
    ),
  ).toEqual(undefined);
});

test('should skip renameOperator if does not exist x_axis and is_timeseries', () => {
  expect(
    renameOperator(
      {
        ...formData,
        ...{ x_axis: null },
      },
      { ...queryObject, ...{ is_timeseries: false } },
    ),
  ).toEqual(undefined);
});

test('should skip renameOperator if not is_timeseries and multi metrics', () => {
  expect(
    renameOperator(formData, {
      ...queryObject,
      ...{ is_timeseries: false, metrics: ['count(*)', 'sum(val)'] },
    }),
  ).toEqual(undefined);
});

test('should add renameOperator', () => {
  expect(renameOperator(formData, queryObject)).toEqual({
    operation: 'rename',
    options: { columns: { 'count(*)': null }, inplace: true, level: 0 },
  });
});

test('should add renameOperator if a metric exists and multiple time shift', () => {
  expect(
    renameOperator(
      {
        ...formData,
        ...{ time_compare: ['1 year ago', '2 years ago'] },
      },
      {
        ...queryObject,
        ...{
          columns: [],
        },
      },
    ),
  ).toEqual({
    operation: 'rename',
    options: { columns: { 'count(*)': null }, inplace: true, level: 0 },
  });
});

test('should add renameOperator if exists derived metrics', () => {
  [
    ComparisonType.Difference,
    ComparisonType.Ratio,
    ComparisonType.Percentage,
  ].forEach(type => {
    expect(
      renameOperator(
        {
          ...formData,
          ...{
            comparison_type: type,
            time_compare: ['1 year ago'],
          },
        },
        {
          ...queryObject,
          ...{
            metrics: ['count(*)'],
          },
        },
      ),
    ).toEqual({
      operation: 'rename',
      options: {
        columns: { [`${type}__count(*)__count(*)__1 year ago`]: '1 year ago' },
        inplace: true,
        level: 0,
      },
    });
  });
});

test('should add renameOperator if isTimeComparisonValue without columns', () => {
  [
    ComparisonType.Difference,
    ComparisonType.Ratio,
    ComparisonType.Percentage,
  ].forEach(type => {
    expect(
      renameOperator(
        {
          ...formData,
          ...{
            comparison_type: type,
            time_compare: ['1 year ago'],
          },
        },
        {
          ...queryObject,
          ...{
            columns: [],
            metrics: ['sum(val)', 'avg(val2)'],
          },
        },
      ),
    ).toEqual({
      operation: 'rename',
      options: {
        columns: {
          [`${type}__avg(val2)__avg(val2)__1 year ago`]:
            'avg(val2), 1 year ago',
          [`${type}__sum(val)__sum(val)__1 year ago`]: 'sum(val), 1 year ago',
        },
        inplace: true,
        level: 0,
      },
    });
  });
});

test('should add renameOperator if x_axis does not exist', () => {
  expect(
    renameOperator(
      {
        ...formData,
        ...{ x_axis: null, granularity_sqla: 'time column' },
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'rename',
    options: { columns: { 'count(*)': null }, inplace: true, level: 0 },
  });
});

test('should add renameOperator if based on series_columns', () => {
  expect(
    renameOperator(
      {
        ...formData,
        ...{ x_axis: null, granularity_sqla: 'time column' },
      },
      {
        ...queryObject,
        columns: [],
        series_columns: ['gender', 'dttm'],
      },
    ),
  ).toEqual({
    operation: 'rename',
    options: { columns: { 'count(*)': null }, inplace: true, level: 0 },
  });
});

test('should add renameOperator if exist "actual value" time comparison', () => {
  expect(
    renameOperator(
      {
        ...formData,
        ...{
          comparison_type: ComparisonType.Values,
          time_compare: ['1 year ago', '1 year later'],
        },
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'rename',
    options: {
      columns: {
        'count(*)__1 year ago': '1 year ago',
        'count(*)__1 year later': '1 year later',
      },
      inplace: true,
      level: 0,
    },
  });
});

test('should add renameOperator if derived time comparison exists', () => {
  expect(
    renameOperator(
      {
        ...formData,
        ...{
          comparison_type: ComparisonType.Ratio,
          time_compare: ['1 year ago', '1 year later'],
        },
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'rename',
    options: {
      columns: {
        'ratio__count(*)__count(*)__1 year ago': '1 year ago',
        'ratio__count(*)__count(*)__1 year later': '1 year later',
      },
      inplace: true,
      level: 0,
    },
  });
});

test('should add renameOperator if multiple metrics exist', () => {
  expect(
    renameOperator(
      {
        ...formData,
        ...{
          comparison_type: ComparisonType.Values,
          time_compare: ['1 year ago'],
        },
      },
      {
        ...queryObject,
        ...{
          metrics: ['count(*)', 'sum(sales)'],
        },
      },
    ),
  ).toEqual({
    operation: 'rename',
    options: {
      columns: {
        'count(*)__1 year ago': 'count(*), 1 year ago',
        'sum(sales)__1 year ago': 'sum(sales), 1 year ago',
      },
      inplace: true,
      level: 0,
    },
  });
});

test('should remove renameOperator', () => {
  expect(
    renameOperator(
      {
        ...formData,
        truncate_metric: false,
      },
      queryObject,
    ),
  ).toEqual(undefined);
  expect(
    renameOperator(
      {
        ...formData,
        truncate_metric: undefined,
      },
      queryObject,
    ),
  ).toEqual(undefined);
});
