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
import { SqlaFormData, VizType } from '@superset-ui/core';
import buildQuery from '../../src/Timeseries/buildQuery';

describe('Timeseries buildQuery', () => {
  const formData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    metrics: ['bar', 'baz'],
    viz_type: 'my_chart',
  };

  test('should build groupby with series in form data', () => {
    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;
    expect(query.metrics).toEqual(['bar', 'baz']);
  });

  test('should order by timeseries limit if orderby unspecified', () => {
    const queryContext = buildQuery({
      ...formData,
      timeseries_limit_metric: 'bar',
      order_desc: true,
    });
    const [query] = queryContext.queries;
    expect(query.metrics).toEqual(['bar', 'baz']);
    expect(query.series_limit_metric).toEqual('bar');
    expect(query.order_desc).toEqual(true);
    expect(query.orderby).toEqual([['bar', false]]);
  });

  test('should include the scatter dot size metric in query metrics', () => {
    const queryContext = buildQuery({
      ...formData,
      size: 'qux',
    });
    const [query] = queryContext.queries;
    expect(query.metrics).toEqual(['bar', 'baz', 'qux']);
  });

  test('should dedupe the dot size metric when it is also a value metric', () => {
    const queryContext = buildQuery({
      ...formData,
      size: 'bar',
    });
    const [query] = queryContext.queries;
    expect(query.metrics).toEqual(['bar', 'baz']);
  });

  test('should query the sort-only limit metric with dimensions so its pivoted columns can order the axis', () => {
    const queryContext = buildQuery({
      ...formData,
      metrics: ['count'],
      x_axis: 'genre',
      groupby: ['platform'],
      timeseries_limit_metric: 'na_sales',
      x_axis_sort: 'na_sales',
      x_axis_sort_asc: false,
    });
    const [query] = queryContext.queries;
    expect(query.metrics).toEqual(['count', 'na_sales']);
    const pivot = (query.post_processing || []).find(
      op => op?.operation === 'pivot',
    );
    expect(pivot?.options).toMatchObject({
      index: ['genre'],
      columns: ['platform'],
      aggregates: {
        count: { operator: 'mean' },
        na_sales: { operator: 'mean' },
      },
    });
    // With dimensions the chart sorts the pivoted rows itself.
    expect(
      (query.post_processing || []).map(op => op?.operation),
    ).not.toContain('sort');
  });

  test('should not query the limit metric with dimensions when the axis is sorted by a series aggregate', () => {
    const queryContext = buildQuery({
      ...formData,
      metrics: ['count'],
      x_axis: 'genre',
      groupby: ['platform'],
      timeseries_limit_metric: 'na_sales',
      x_axis_sort: 'sum',
      x_axis_sort_asc: false,
    });
    const [query] = queryContext.queries;
    expect(query.metrics).toEqual(['count']);
  });

  test('should keep the sort-only metric through the pivot with time comparison', () => {
    const queryContext = buildQuery({
      ...formData,
      metrics: ['count'],
      x_axis: 'genre',
      groupby: ['platform'],
      timeseries_limit_metric: 'na_sales',
      x_axis_sort: 'na_sales',
      x_axis_sort_asc: false,
      comparison_type: 'values',
      time_compare: ['1 week ago'],
    });
    const [query] = queryContext.queries;
    expect(query.metrics).toEqual(['count', 'na_sales']);
    const pivot = (query.post_processing || []).find(
      operator => operator?.operation === 'pivot',
    );
    // The sort metric survives the pivot under its base label only; its
    // time-shifted column is dropped along with the rest.
    expect(Object.keys(pivot?.options?.aggregates ?? {}).sort()).toEqual([
      'count',
      'count__1 week ago',
      'na_sales',
    ]);
  });

  test('should apply contribution before rename with time comparison', () => {
    // rename strips the `__<offset>` suffix that contribution relies on to
    // compute each time shift separately
    const queryContext = buildQuery({
      ...formData,
      metrics: ['bar'],
      x_axis: 'ds',
      groupby: ['col1'],
      contributionMode: 'row',
      comparison_type: 'values',
      time_compare: ['1 week ago'],
    });
    const [query] = queryContext.queries;
    const operations = (query.post_processing || []).map(
      operator => operator?.operation,
    );
    expect(operations).toContain('contribution');
    expect(operations.indexOf('contribution')).toBeLessThan(
      operations.indexOf('rename'),
    );
  });

  test('should not order by timeseries limit if orderby provided', () => {
    const queryContext = buildQuery({
      ...formData,
      timeseries_limit_metric: 'bar',
      order_desc: true,
      orderby: [['foo', true]],
    });
    const [query] = queryContext.queries;
    expect(query.metrics).toEqual(['bar', 'baz']);
    expect(query.series_limit_metric).toEqual('bar');
    expect(query.order_desc).toEqual(true);
    expect(query.orderby).toEqual([['foo', true]]);
  });
});

describe('queryObject conversion', () => {
  const formData: SqlaFormData = {
    datasource: '5__table',
    viz_type: VizType.Table,
    granularity_sqla: 'time_column',
    time_grain_sqla: 'P1Y',
    time_range: '1 year ago : 2013',
    groupby: ['col1'],
    metrics: ['count(*)'],
  };

  test("shouldn't convert queryObject", () => {
    const { queries } = buildQuery(formData);
    expect(queries[0]).toEqual(
      expect.objectContaining({
        granularity: 'time_column',
        time_range: '1 year ago : 2013',
        extras: { time_grain_sqla: 'P1Y', having: '', where: '' },
        columns: ['col1'],
        series_columns: ['col1'],
        metrics: ['count(*)'],
        is_timeseries: true,
        post_processing: [
          {
            operation: 'pivot',
            options: {
              aggregates: { 'count(*)': { operator: 'mean' } },
              columns: ['col1'],
              drop_missing_columns: true,
              index: ['__timestamp'],
            },
          },
          { operation: 'flatten' },
        ],
      }),
    );
  });

  test('should convert queryObject', () => {
    const { queries } = buildQuery({ ...formData, x_axis: 'time_column' });
    expect(queries[0]).toMatchObject({
      granularity: 'time_column',
      time_range: '1 year ago : 2013',
      extras: { having: '', where: '', time_grain_sqla: 'P1Y' },
      columns: [
        {
          columnType: 'BASE_AXIS',
          expressionType: 'SQL',
          label: 'time_column',
          sqlExpression: 'time_column',
          timeGrain: 'P1Y',
          isColumnReference: true,
        },
        'col1',
      ],
      series_columns: ['col1'],
      metrics: ['count(*)'],
      post_processing: [
        {
          operation: 'pivot',
          options: {
            aggregates: { 'count(*)': { operator: 'mean' } },
            columns: ['col1'],
            drop_missing_columns: true,
            index: ['time_column'],
          },
        },
        { operation: 'flatten' },
      ],
    });
  });
});
