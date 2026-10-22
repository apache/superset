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
import { buildQueryObject, QueryFormData } from '@superset-ui/core';
import { applyDrillByTimeRange, getDrillByTimeRange } from './drillByTimeRange';

const OCT_2003 = '2003-10-01T00:00:00 : 2003-11-01T00:00:00';
const OCT_1_2003 = '2003-10-01T00:00:00 : 2003-10-02T00:00:00';

const monthBucketFilter = {
  col: 'order_date',
  op: 'TEMPORAL_RANGE' as const,
  val: OCT_2003,
  formattedVal: 'Oct 2003',
};

test('getDrillByTimeRange returns the TEMPORAL_RANGE drill filter value', () => {
  expect(
    getDrillByTimeRange([
      {
        groupbyFieldName: 'groupby',
        filters: [
          { col: 'deal_size', op: '==', val: 'Small' },
          monthBucketFilter,
        ],
      },
    ]),
  ).toEqual(OCT_2003);
});

test('getDrillByTimeRange returns the innermost bucket of nested drills', () => {
  expect(
    getDrillByTimeRange([
      { groupbyFieldName: 'groupby', filters: [monthBucketFilter] },
      {
        groupbyFieldName: 'groupby',
        filters: [{ ...monthBucketFilter, val: OCT_1_2003 }],
      },
    ]),
  ).toEqual(OCT_1_2003);
});

test('getDrillByTimeRange ignores categorical and exact-match filters', () => {
  expect(
    getDrillByTimeRange([
      {
        groupbyFieldName: 'groupby',
        filters: [
          { col: 'deal_size', op: '==', val: 'Small' },
          { col: 'order_date', op: '==', val: '2003-10-01T00:00:00' },
        ],
      },
    ]),
  ).toBeUndefined();
  expect(getDrillByTimeRange([])).toBeUndefined();
});

test('applyDrillByTimeRange leaves form data unchanged without a bucket', () => {
  const formData = { time_range: 'No filter', groupby: ['deal_size'] };
  expect(applyDrillByTimeRange(formData, undefined)).toBe(formData);
});

test('applyDrillByTimeRange replaces the chart time range with the bucket', () => {
  expect(applyDrillByTimeRange({ time_range: 'No filter' }, OCT_2003)).toEqual({
    time_range: OCT_2003,
  });
});

test('applyDrillByTimeRange replaces a dashboard time range override', () => {
  expect(
    applyDrillByTimeRange(
      {
        time_range: 'No filter',
        extra_form_data: {
          time_range: '2003-01-01 : 2005-01-01',
          filters: [{ col: 'country', op: 'IN', val: ['USA'] }],
        },
      },
      OCT_2003,
    ),
  ).toEqual({
    time_range: OCT_2003,
    extra_form_data: {
      time_range: OCT_2003,
      filters: [{ col: 'country', op: 'IN', val: ['USA'] }],
    },
  });
});

test('applyDrillByTimeRange does not add a time range to extra_form_data', () => {
  expect(
    applyDrillByTimeRange(
      { time_range: 'No filter', extra_form_data: { filters: [] } },
      OCT_2003,
    ),
  ).toEqual({ time_range: OCT_2003, extra_form_data: { filters: [] } });
});

test('the drilled query object carries the bucket as its time range', () => {
  // The backend replaces every TEMPORAL_RANGE filter value with the query
  // object's time_range, so that is the value that has to hold the bucket.
  const formData = {
    datasource: '1__table',
    viz_type: 'echarts_timeseries',
    time_range: 'No filter',
    adhoc_filters: [
      {
        clause: 'WHERE',
        expressionType: 'SIMPLE',
        operator: 'TEMPORAL_RANGE',
        subject: 'order_date',
        comparator: OCT_2003,
      },
    ],
    extra_form_data: { time_range: '2003-01-01 : 2005-01-01' },
  } as QueryFormData;

  expect(buildQueryObject(formData).time_range).toEqual(
    '2003-01-01 : 2005-01-01',
  );
  expect(
    buildQueryObject(applyDrillByTimeRange(formData, OCT_2003)).time_range,
  ).toEqual(OCT_2003);
});
