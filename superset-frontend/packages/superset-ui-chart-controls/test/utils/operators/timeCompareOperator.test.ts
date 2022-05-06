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
import { timeCompareOperator } from '../../../src';

const formData: SqlaFormData = {
  metrics: [
    'count(*)',
    { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
  ],
  time_range: '2015 : 2016',
  granularity: 'month',
  datasource: 'foo',
  viz_type: 'table',
};
const queryObject: QueryObject = {
  metrics: [
    'count(*)',
    { label: 'sum(val)', expressionType: 'SQL', sqlExpression: 'sum(val)' },
  ],
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
          'sum(val)': {
            operator: 'mean',
          },
        },
        drop_missing_columns: false,
        flatten_columns: false,
        reset_index: false,
      },
    },
    {
      operation: 'aggregation',
      options: {
        groupby: ['col1'],
        aggregates: {},
      },
    },
  ],
};

test('should skip CompareOperator', () => {
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

test('should generate difference/percentage/ratio CompareOperator', () => {
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
        source_columns: ['count(*)', 'count(*)', 'sum(val)', 'sum(val)'],
        compare_columns: [
          'count(*)__1 year ago',
          'count(*)__1 year later',
          'sum(val)__1 year ago',
          'sum(val)__1 year later',
        ],
        compare_type: cType,
        drop_original_columns: true,
      },
    });
  });
});
