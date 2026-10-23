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

const temporalFilter = (subject: string, comparator: string) => ({
  clause: 'WHERE' as const,
  expressionType: 'SIMPLE' as const,
  operator: 'TEMPORAL_RANGE' as const,
  subject,
  comparator,
});
const SHIP_RANGE = '2003-01-01 : 2004-06-01';
const ORDER_RANGE = '2003-10-15 : 2004-02-15';

test('getDrillByOuterTimeRange ignores a query-wide range on a column without a date filter', () => {
  const formData: QueryFormData = {
    datasource: '1__table',
    viz_type: 'echarts_timeseries_bar',
    x_axis: 'order_date',
    time_range: 'Last year',
    adhoc_filters: [temporalFilter('ship_date', SHIP_RANGE)],
  };
  // _apply_filters writes the range into TEMPORAL_RANGE filters only.
  expect(getDrillByOuterTimeRange(formData, 'order_date')).toBeUndefined();
  expect(getDrillByOuterTimeRange(formData, 'ship_date')).toBe('Last year');
  expect(
    getDrillByOuterTimeRange(
      {
        ...formData,
        time_range: 'No filter',
        extra_form_data: { time_range: 'Last week' },
      },
      'order_date',
    ),
  ).toBeUndefined();
  expect(
    getDrillByOuterTimeRange(
      {
        ...formData,
        time_range: 'No filter',
        extra_filters: [{ col: '__time_range', op: '==', val: 'Last week' }],
      },
      'order_date',
    ),
  ).toBeUndefined();
});

test.each([
  ['saved', { granularity_sqla: 'order_date' }],
  ['dashboard', { extra_form_data: { granularity_sqla: 'order_date' } }],
  [
    'legacy',
    { extra_filters: [{ col: '__time_col', op: '==', val: 'order_date' }] },
  ],
])(
  'getDrillByOuterTimeRange follows a %s time column on the x-axis',
  (_, timeColumn) => {
    const formData = {
      datasource: '1__table',
      viz_type: 'echarts_timeseries_bar',
      x_axis: 'order_date',
      ...timeColumn,
    } as QueryFormData;
    const withFilters = (...filters: ReturnType<typeof temporalFilter>[]) => ({
      ...formData,
      adhoc_filters: filters,
    });
    // The time column is filtered by the query range, even when the x-axis
    // has no date filter of its own.
    expect(
      getDrillByOuterTimeRange(
        {
          ...withFilters(temporalFilter('ship_date', SHIP_RANGE)),
          time_range: 'Last year',
        },
        'order_date',
      ),
    ).toBe('Last year');
    // Otherwise by the first x-axis filter, or else the first date filter.
    expect(
      getDrillByOuterTimeRange(
        withFilters(
          temporalFilter('ship_date', SHIP_RANGE),
          temporalFilter('order_date', ORDER_RANGE),
        ),
        'order_date',
      ),
    ).toBe(ORDER_RANGE);
    expect(
      getDrillByOuterTimeRange(
        withFilters(temporalFilter('ship_date', SHIP_RANGE)),
        'order_date',
      ),
    ).toBe(SHIP_RANGE);
  },
);

test('getDrillByOuterTimeRange without an x-axis follows the time column and skips a dropped filter', () => {
  const formData: QueryFormData = {
    datasource: '1__table',
    viz_type: 'echarts_timeseries_bar',
    granularity_sqla: 'order_date',
    adhoc_filters: [temporalFilter('ship_date', SHIP_RANGE)],
  };
  expect(getDrillByOuterTimeRange(formData, 'order_date')).toBe(SHIP_RANGE);
  // The backend drops the first date filter when the time column has none.
  expect(getDrillByOuterTimeRange(formData, 'ship_date')).toBeUndefined();
  expect(
    getDrillByOuterTimeRange(
      {
        ...formData,
        adhoc_filters: [
          temporalFilter('ship_date', SHIP_RANGE),
          temporalFilter('order_date', ORDER_RANGE),
        ],
      },
      'ship_date',
    ),
  ).toBe(SHIP_RANGE);
});

test('with a time column every x-axis filter carries the intersected buckets', () => {
  const source = {
    datasource: '1__table',
    viz_type: 'echarts_timeseries_bar',
    x_axis: 'order_date',
    granularity_sqla: 'order_date',
    time_range: 'Last year',
    adhoc_filters: [
      temporalFilter('order_date', 'No filter'),
      temporalFilter('ship_date', SHIP_RANGE),
    ],
  } as QueryFormData;
  const formData = {
    ...source,
    adhoc_filters: [
      ...source.adhoc_filters!,
      temporalFilter('order_date', OCT_2003),
      temporalFilter('ship_date', '2004-01-01T00:00:00 : 2004-02-01T00:00:00'),
      temporalFilter('order_date', OCT_1_2003),
    ],
  };
  const drilled = applyDrillByTimeRange(
    formData,
    '2004-01-01T00:00:00 : 2004-02-01T00:00:00',
    {
      col: 'ship_date',
      op: 'TEMPORAL_RANGE',
      val: '2004-01-01T00:00:00 : 2004-02-01T00:00:00',
    },
    source,
  );
  const query = buildQueryObject(drilled);
  expect(query.time_range).toBeUndefined();
  expect(query.granularity).toBe('order_date');
  expect(query.filters).toEqual([
    expect.objectContaining({ col: 'order_date', val: OCT_1_2003 }),
    expect.objectContaining({ col: 'ship_date', val: 'Last year' }),
    expect.objectContaining({ col: 'order_date', val: OCT_1_2003 }),
    expect.objectContaining({
      col: 'ship_date',
      val: '2004-01-01T00:00:00 : 2004-02-01T00:00:00',
    }),
    expect.objectContaining({ col: 'order_date', val: OCT_1_2003 }),
  ]);
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
  'query-wide ranges retain the chart row set on independent dates in %s',
  filterField => {
    const shipRange = '2004-01-01 : 2005-01-01';
    const savedFilter = {
      clause: 'WHERE',
      expressionType: 'SIMPLE',
      operator: 'TEMPORAL_RANGE',
      subject: 'ship_date',
      comparator: shipRange,
    };
    const shapes = [
      {},
      { time_range: 'No filter' },
      { time_range: YEAR_2003 },
      { time_range: 'No filter', extra_form_data: { time_range: YEAR_2003 } },
      {
        time_range: 'No filter',
        extra_filters: [{ col: '__time_range', op: '==', val: YEAR_2003 }],
      },
    ];
    shapes.forEach(shape => {
      const source = {
        datasource: '1__table',
        viz_type: 'mixed_timeseries',
        ...shape,
        [filterField]: [savedFilter],
      } as QueryFormData;
      const formData = {
        ...source,
        [filterField]: [
          savedFilter,
          {
            ...savedFilter,
            subject: 'order_date',
            comparator: OCT_2003,
          },
        ],
      };
      const before = JSON.parse(JSON.stringify(formData));
      const chart = buildQueryObject({
        ...source,
        adhoc_filters: source[filterField],
      });
      const drilled = applyDrillByTimeRange(
        formData,
        OCT_1_2003,
        monthBucketFilter,
        source,
      );
      const query = buildQueryObject({
        ...drilled,
        adhoc_filters: drilled[filterField],
      });
      expect(query.time_range).toBeFalsy();
      expect(query.filters).toEqual([
        expect.objectContaining({
          col: 'ship_date',
          val: chart.time_range ?? shipRange,
        }),
        expect.objectContaining({ col: 'order_date', val: OCT_1_2003 }),
      ]);
      // Model _apply_filters: a truthy query-wide range replaces every temporal
      // value. Compare actual rows rather than a mocked aggregate response.
      const rows = [
        { order_date: '2003-10-01T12:00:00', ship_date: '2003-12-01T00:00:00' },
        { order_date: '2003-10-01T12:00:00', ship_date: '2004-01-01T00:00:00' },
        { order_date: '2003-10-02T12:00:00', ship_date: '2004-01-01T00:00:00' },
      ];
      const inRange = (value: string, range: string) => {
        if (range === 'No filter') return true;
        const [since, until] = range.split(' : ');
        return value >= since && value < until;
      };
      const expected = rows.filter(
        row =>
          inRange(row.order_date, OCT_1_2003) &&
          inRange(row.ship_date, chart.time_range ?? shipRange),
      );
      const actual = rows.filter(row =>
        query.filters?.every(
          filter =>
            filter.op !== 'TEMPORAL_RANGE' ||
            inRange(row[filter.col as keyof typeof row], String(filter.val)),
        ),
      );
      expect(actual).toEqual(expected);
      expect(formData).toEqual(before);
    });
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

test.each(['extra_filters', 'native_filters', 'native_adhoc_filters'])(
  'independent dashboard temporal filters keep their effective range from %s',
  location => {
    const savedRange = '2004-01-01 : 2005-01-01';
    const filter = {
      col: 'ship_date',
      op: 'TEMPORAL_RANGE' as const,
      val: savedRange,
    };
    const adhoc = {
      clause: 'WHERE' as const,
      expressionType: 'SIMPLE' as const,
      operator: 'TEMPORAL_RANGE' as const,
      subject: 'ship_date',
      comparator: savedRange,
    };
    const source = {
      datasource: '1__table',
      viz_type: 'echarts_timeseries_bar',
      time_range: 'No filter',
      extra_filters: location === 'extra_filters' ? [filter] : [],
      extra_form_data: {
        time_range: YEAR_2003,
        filters: location === 'native_filters' ? [filter] : [],
        adhoc_filters: location === 'native_adhoc_filters' ? [adhoc] : [],
      },
    } as QueryFormData;
    const formData = {
      ...source,
      adhoc_filters: [
        { ...adhoc, subject: 'order_date', comparator: OCT_2003 },
      ],
    };
    const query = buildQueryObject(
      applyDrillByTimeRange(formData, OCT_2003, monthBucketFilter, source),
    );
    expect(query.time_range).toBeUndefined();
    expect(query.filters).toContainEqual(
      expect.objectContaining({ col: 'ship_date', val: YEAR_2003 }),
    );
    expect(query.filters).toContainEqual(
      expect.objectContaining({ col: 'order_date', val: OCT_2003 }),
    );
    expect(source.extra_form_data?.time_range).toBe(YEAR_2003);
    expect(filter.val).toBe(savedRange);
    expect(adhoc.comparator).toBe(savedRange);
  },
);

test('Mixed Timeseries resolves the outer range from the clicked query filter field', () => {
  const source = {
    datasource: '1__table',
    viz_type: 'mixed_timeseries',
    adhoc_filters: [],
    adhoc_filters_b: [
      {
        clause: 'WHERE',
        expressionType: 'SIMPLE',
        subject: 'order_date',
        operator: 'TEMPORAL_RANGE',
        comparator: YEAR_2003,
      },
    ],
  } as QueryFormData;
  expect(
    getDrillByOuterTimeRange(source, 'order_date', 'adhoc_filters_b'),
  ).toBe(YEAR_2003);
  expect(getDrillByOuterTimeRange(source, 'order_date')).toBeUndefined();
});
