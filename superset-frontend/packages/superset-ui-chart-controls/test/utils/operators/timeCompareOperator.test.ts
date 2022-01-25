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
import { QueryObject, SqlaFormData } from '@superset-ui/core';
import { timeCompareOperator, timeComparePivotOperator } from '../../../src';

const formData: SqlaFormData = {
  metrics: ['count(*)'],
  time_range: '2015 : 2016',
  granularity: 'month',
  datasource: 'foo',
  viz_type: 'table',
};
const queryObject: QueryObject = {
  metrics: ['count(*)'],
  time_range: '2015 : 2016',
  granularity: 'month',
  post_processing: [
    {
      operation: 'pivot',
      options: {
        index: ['__timestamp'],
        columns: ['nation'],
        aggregates: {
          'count(*)': {
            operator: 'mean',
          },
        },
        drop_missing_columns: false,
      },
    },
    {
      operation: 'aggregation',
      options: {
        groupby: ['col1'],
        aggregates: 'count',
      },
    },
  ],
};

test('time compare: skip transformation', () => {
  expect(timeCompareOperator(formData, queryObject)).toEqual(undefined);
  expect(
    timeCompareOperator({ ...formData, time_compare: [] }, queryObject),
  ).toEqual(undefined);
  expect(
    timeCompareOperator({ ...formData, comparison_type: null }, queryObject),
  ).toEqual(undefined);
  expect(
    timeCompareOperator(
      { ...formData, comparison_type: 'foobar' },
      queryObject,
    ),
  ).toEqual(undefined);
  expect(
    timeCompareOperator(
      {
        ...formData,
        comparison_type: 'values',
        time_compare: ['1 year ago', '1 year later'],
      },
      queryObject,
    ),
  ).toEqual(undefined);
});

test('time compare: difference/percentage/ratio', () => {
  const comparisionTypes = ['difference', 'percentage', 'ratio'];
  comparisionTypes.forEach(cType => {
    expect(
      timeCompareOperator(
        {
          ...formData,
          comparison_type: cType,
          time_compare: ['1 year ago', '1 year later'],
        },
        queryObject,
      ),
    ).toEqual({
      operation: 'compare',
      options: {
        source_columns: ['count(*)', 'count(*)'],
        compare_columns: ['count(*)__1 year ago', 'count(*)__1 year later'],
        compare_type: cType,
        drop_original_columns: true,
      },
    });
  });
});

test('time compare pivot: skip transformation', () => {
  expect(timeComparePivotOperator(formData, queryObject)).toEqual(undefined);
  expect(
    timeComparePivotOperator({ ...formData, time_compare: [] }, queryObject),
  ).toEqual(undefined);
  expect(
    timeComparePivotOperator(
      { ...formData, comparison_type: null },
      queryObject,
    ),
  ).toEqual(undefined);
  expect(
    timeCompareOperator(
      { ...formData, comparison_type: 'foobar' },
      queryObject,
    ),
  ).toEqual(undefined);
});

test('time compare pivot: values', () => {
  expect(
    timeComparePivotOperator(
      {
        ...formData,
        comparison_type: 'values',
        time_compare: ['1 year ago', '1 year later'],
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'pivot',
    options: {
      aggregates: {
        'count(*)': { operator: 'mean' },
        'count(*)__1 year ago': { operator: 'mean' },
        'count(*)__1 year later': { operator: 'mean' },
      },
      drop_missing_columns: false,
      columns: [],
      index: ['__timestamp'],
    },
  });
});

test('time compare pivot: difference/percentage/ratio', () => {
  const comparisionTypes = ['difference', 'percentage', 'ratio'];
  comparisionTypes.forEach(cType => {
    expect(
      timeComparePivotOperator(
        {
          ...formData,
          comparison_type: cType,
          time_compare: ['1 year ago', '1 year later'],
        },
        queryObject,
      ),
    ).toEqual({
      operation: 'pivot',
      options: {
        aggregates: {
          [`${cType}__count(*)__count(*)__1 year ago`]: { operator: 'mean' },
          [`${cType}__count(*)__count(*)__1 year later`]: { operator: 'mean' },
        },
        drop_missing_columns: false,
        columns: [],
        index: ['__timestamp'],
      },
    });
  });
});

test('time compare pivot on x-axis', () => {
  expect(
    timeComparePivotOperator(
      {
        ...formData,
        comparison_type: 'values',
        time_compare: ['1 year ago', '1 year later'],
        x_axis: 'ds',
      },
      queryObject,
    ),
  ).toEqual({
    operation: 'pivot',
    options: {
      aggregates: {
        'count(*)': { operator: 'mean' },
        'count(*)__1 year ago': { operator: 'mean' },
        'count(*)__1 year later': { operator: 'mean' },
      },
      drop_missing_columns: false,
      columns: [],
      index: ['ds'],
    },
  });
});
