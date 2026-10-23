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
import fetchMock from 'fetch-mock';
import { buildQueryObject, QueryFormData } from '@superset-ui/core';
import {
  applyDrillByTimeRange,
  fetchDrillByTimeRange,
  getDrillByOuterTimeRange,
  getDrillByTimeRange,
  intersectTimeRanges,
} from './drillByTimeRange';

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

test('getDrillByTimeRange retains the temporal bucket through categorical drills and breadcrumb navigation', () => {
  const configs = [
    { groupbyFieldName: 'groupby', filters: [monthBucketFilter] },
    {
      groupbyFieldName: 'groupby',
      filters: [{ ...monthBucketFilter, val: OCT_1_2003 }],
    },
    {
      groupbyFieldName: 'groupby',
      filters: [{ col: 'deal_size', op: '==' as const, val: 'Small' }],
    },
  ];
  expect(getDrillByTimeRange(configs)).toEqual(OCT_1_2003);
  expect(getDrillByTimeRange(configs.slice(0, 1))).toEqual(OCT_2003);
  expect(getDrillByTimeRange(configs.slice(0, 0))).toBeUndefined();
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
  const formData = {
    time_range: 'No filter',
    groupby: ['deal_size'],
    extra_filters: [{ col: '__time_range', op: '==', val: 'Last year' }],
    extra_form_data: { time_range: 'Last month' },
  };
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

test('the drilled query overrides a legacy dashboard time range without changing other filters', () => {
  const formData: QueryFormData = {
    datasource: '1__table',
    viz_type: 'echarts_timeseries',
    time_range: 'No filter',
    extra_filters: [
      { col: '__time_range', op: '==', val: '2003-01-01 : 2005-01-01' },
      { col: 'country', op: 'IN', val: ['USA'] },
    ],
  };
  const original = JSON.parse(JSON.stringify(formData));
  const drilledQuery = buildQueryObject(
    applyDrillByTimeRange(formData, OCT_2003),
  );

  expect(drilledQuery.time_range).toEqual(OCT_2003);
  expect(drilledQuery.applied_time_extras).toEqual({
    __time_range: OCT_2003,
  });
  expect(drilledQuery.filters).toContainEqual({
    col: 'country',
    op: 'IN',
    val: ['USA'],
    isExtra: true,
  });
  expect(formData).toEqual(original);
});

test('the drilled query keeps categorical cross-filters and narrows a temporal cross-filter override', () => {
  const formData: QueryFormData = {
    datasource: '1__table',
    viz_type: 'echarts_timeseries',
    time_range: 'No filter',
    extra_form_data: {
      time_range: OCT_2003,
      filters: [
        { col: 'order_date', op: 'TEMPORAL_RANGE', val: OCT_2003 },
        { col: 'deal_size', op: 'IN', val: ['Small'] },
      ],
    },
  };
  const drilledQuery = buildQueryObject(
    applyDrillByTimeRange(formData, OCT_1_2003),
  );
  expect(drilledQuery.time_range).toEqual(OCT_1_2003);
  expect(drilledQuery.filters).toEqual([
    {
      col: 'order_date',
      op: 'TEMPORAL_RANGE',
      val: OCT_2003,
      isExtra: true,
    },
    { col: 'deal_size', op: 'IN', val: ['Small'], isExtra: true },
  ]);
  expect(formData.extra_form_data?.time_range).toEqual(OCT_2003);
});

const YEAR_2003 = '2003-01-01T00:00:00 : 2004-01-01T00:00:00';
const TIME_RANGE_ENDPOINT = 'glob:*/api/v1/time_range/*';

afterEach(() => fetchMock.removeRoutes().clearHistory());

test('intersectTimeRanges keeps a bucket that lies inside the outer range', () => {
  expect(
    intersectTimeRanges(OCT_2003, '2003-01-01T00:00:00', '2005-01-01T00:00:00'),
  ).toEqual(OCT_2003);
});

test('intersectTimeRanges keeps only the part of a bucket inside the outer range', () => {
  expect(
    intersectTimeRanges(
      YEAR_2003,
      '2003-06-01T00:00:00',
      '2003-11-15T12:30:00.250000',
    ),
  ).toEqual('2003-06-01T00:00:00 : 2003-11-15T12:30:00.250000');
});

test('intersectTimeRanges treats an empty outer bound as unbounded', () => {
  expect(intersectTimeRanges(YEAR_2003, '', '2003-06-01T00:00:00')).toEqual(
    '2003-01-01T00:00:00 : 2003-06-01T00:00:00',
  );
  expect(intersectTimeRanges(YEAR_2003, '2003-06-01T00:00:00', '')).toEqual(
    '2003-06-01T00:00:00 : 2004-01-01T00:00:00',
  );
});

test('intersectTimeRanges returns an empty range when the bucket is outside the outer range', () => {
  expect(
    intersectTimeRanges(
      YEAR_2003,
      '2004-02-01T00:00:00',
      '2004-03-01T00:00:00',
    ),
  ).toEqual('2004-02-01T00:00:00 : 2004-02-01T00:00:00');
});

test('getDrillByOuterTimeRange follows the precedence of the chart query', () => {
  const formData: QueryFormData = {
    datasource: '1__table',
    viz_type: 'echarts_timeseries',
    time_range: 'Last year',
    adhoc_filters: [
      {
        clause: 'WHERE',
        expressionType: 'SIMPLE',
        operator: 'TEMPORAL_RANGE',
        subject: 'order_date',
        comparator: '2003-06-01 : 2004-01-01',
      },
    ],
  };
  expect(getDrillByOuterTimeRange(formData, 'order_date')).toEqual('Last year');
  expect(
    getDrillByOuterTimeRange(
      {
        ...formData,
        extra_filters: [{ col: '__time_range', op: '==', val: 'Last week' }],
      },
      'order_date',
    ),
  ).toEqual('Last week');
  expect(
    getDrillByOuterTimeRange(
      {
        ...formData,
        extra_form_data: { time_range: '2003-01-01 : 2005-01-01' },
      },
      'order_date',
    ),
  ).toEqual('2003-01-01 : 2005-01-01');
  // Without a time_range the chart's own range on the drilled column applies.
  const { time_range: _, ...ownRangeOnly } = formData;
  expect(getDrillByOuterTimeRange(ownRangeOnly, 'order_date')).toEqual(
    '2003-06-01 : 2004-01-01',
  );
  expect(getDrillByOuterTimeRange(ownRangeOnly, 'ship_date')).toBeUndefined();
});

test('getDrillByOuterTimeRange returns undefined for an unlimited chart', () => {
  expect(
    getDrillByOuterTimeRange(
      {
        datasource: '1__table',
        viz_type: 'echarts_timeseries',
        time_range: 'No filter',
      },
      'order_date',
    ),
  ).toBeUndefined();
});

test('fetchDrillByTimeRange intersects the bucket with the resolved outer range', async () => {
  fetchMock.get(TIME_RANGE_ENDPOINT, {
    result: [
      {
        since: '2003-06-01T00:00:00',
        until: '2004-01-01T00:00:00',
        timeRange: 'Last year',
      },
    ],
  });
  await expect(fetchDrillByTimeRange(YEAR_2003, 'Last year')).resolves.toEqual(
    '2003-06-01T00:00:00 : 2004-01-01T00:00:00',
  );
  expect(fetchMock.callHistory.lastCall(TIME_RANGE_ENDPOINT)?.url).toContain(
    '?q=%27Last+year%27',
  );
});

test('fetchDrillByTimeRange falls back to the bucket when the range cannot be resolved', async () => {
  fetchMock.get(TIME_RANGE_ENDPOINT, 400);
  await expect(fetchDrillByTimeRange(YEAR_2003, 'nonsense')).resolves.toEqual(
    YEAR_2003,
  );
});

test.each(['adhoc_filters', 'adhoc_filters_b'])(
  'independent temporal filters and outer drill buckets survive dashboard overrides in %s',
  filterField => {
    const shipRange = '2004-01-01 : 2005-01-01';
    const formData: QueryFormData = {
      datasource: '1__table',
      viz_type: 'mixed_timeseries',
      time_range: 'No filter',
      [filterField]: [
        {
          clause: 'WHERE',
          expressionType: 'SIMPLE',
          operator: 'TEMPORAL_RANGE',
          subject: 'ship_date',
          comparator: shipRange,
        },
        {
          clause: 'WHERE',
          expressionType: 'SIMPLE',
          operator: 'TEMPORAL_RANGE',
          subject: 'order_date',
          comparator: YEAR_2003,
        },
        {
          clause: 'WHERE',
          expressionType: 'SIMPLE',
          operator: 'TEMPORAL_RANGE',
          subject: 'order_date',
          comparator: OCT_2003,
        },
      ],
      extra_filters: [
        { col: '__time_range', op: '==', val: 'Last year' },
        { col: 'country', op: 'IN', val: ['USA'] },
      ],
      extra_form_data: {
        time_range: 'Last month',
        filters: [
          { col: 'delivery_date', op: 'TEMPORAL_RANGE', val: shipRange },
        ],
      },
    };
    // Query B uses the same core query builder after selecting its filter field.
    const before = JSON.parse(JSON.stringify(formData));
    const drilled = applyDrillByTimeRange(
      formData,
      OCT_1_2003,
      monthBucketFilter,
    );
    const query = buildQueryObject({
      ...drilled,
      adhoc_filters: drilled[filterField],
    });
    expect(query.time_range).toBeFalsy();
    expect(query.filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ col: 'ship_date', val: shipRange }),
        expect.objectContaining({ col: 'delivery_date', val: shipRange }),
        expect.objectContaining({ col: 'order_date', val: YEAR_2003 }),
        expect.objectContaining({ col: 'order_date', val: OCT_1_2003 }),
        expect.objectContaining({ col: 'country', val: ['USA'] }),
      ]),
    );
    expect(formData).toEqual(before);
    expect(drilled[filterField]).toContainEqual(
      expect.objectContaining({ subject: 'ship_date', comparator: shipRange }),
    );
    expect(drilled[filterField]).toContainEqual(
      expect.objectContaining({
        subject: 'order_date',
        comparator: OCT_1_2003,
      }),
    );
  },
);

test('a bucket does not introduce a query-wide time range when none was saved', () => {
  const formData = {
    datasource: '1__table',
    viz_type: 'echarts_timeseries_bar',
    extra_form_data: { filters: [] },
  };
  expect(applyDrillByTimeRange(formData, OCT_2003)).toBe(formData);
});
