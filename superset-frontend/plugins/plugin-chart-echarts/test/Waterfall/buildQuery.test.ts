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
import buildQuery from '../../src/Waterfall/buildQuery';

describe('Waterfall buildQuery', () => {
  const formData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    metric: 'foo',
    x_axis: 'bar',
    groupby: ['baz'],
    viz_type: VizType.Waterfall,
  };

  test('should build query fields from form data', () => {
    const queryContext = buildQuery(formData as unknown as SqlaFormData);
    const [query] = queryContext.queries;
    expect(query.metrics).toEqual(['foo']);
    expect(query.columns?.[0]).toEqual(
      expect.objectContaining({ sqlExpression: 'bar' }),
    );
    expect(query.columns?.[1]).toEqual('baz');
  });

  test('orders by the x-axis ascending when no custom sort is set', () => {
    const queryContext = buildQuery(formData as unknown as SqlaFormData);
    const [query] = queryContext.queries;
    expect(query.orderby).toEqual([
      ['bar', true],
      ['baz', true],
    ]);
    // no extra sort column is selected
    expect(query.columns).toHaveLength(2);
  });

  test('sorts by an ungrouped column as an aggregate, leaving the grain alone', () => {
    const queryContext = buildQuery({
      ...formData,
      x_axis_sort: 'sort_order',
      x_axis_sort_asc: true,
    } as unknown as SqlaFormData);
    const [query] = queryContext.queries;
    // The sort key is wrapped in an aggregate so ORDER BY is legal without
    // widening the GROUP BY.
    expect(query.orderby?.[0]).toEqual([
      {
        expressionType: 'SIMPLE',
        column: { column_name: 'sort_order' },
        aggregate: 'MIN',
        label: 'sort_order',
        hasCustomLabel: true,
      },
      true,
    ]);
    // custom sort leads, category grouping columns follow as tiebreakers
    expect(query.orderby?.slice(1)).toEqual([
      ['bar', true],
      ['baz', true],
    ]);
    // Regression (#42372): the sort column must NOT join the GROUP BY, or the
    // query grain changes and row_limit silently truncates the aggregates.
    expect(query.columns).toHaveLength(2);
    expect(query.columns).not.toContain('sort_order');
    // and it must not sneak in as a chart metric either
    expect(query.metrics).toEqual(['foo']);
  });

  test('respects descending order', () => {
    const queryContext = buildQuery({
      ...formData,
      x_axis_sort: 'sort_order',
      x_axis_sort_asc: false,
    } as unknown as SqlaFormData);
    const [query] = queryContext.queries;
    expect(query.orderby?.[0]).toEqual([
      expect.objectContaining({
        expressionType: 'SIMPLE',
        column: { column_name: 'sort_order' },
        aggregate: 'MIN',
      }),
      false,
    ]);
    expect(query.columns).toHaveLength(2);
  });

  test('sorts by a metric by label, without aggregating it again', () => {
    const queryContext = buildQuery({
      ...formData,
      x_axis_sort: 'foo',
      x_axis_sort_asc: false,
    } as unknown as SqlaFormData);
    const [query] = queryContext.queries;
    expect(query.orderby?.[0]).toEqual(['foo', false]);
    // 'foo' is a metric, not a column — columns stay at x_axis + breakdown
    expect(query.columns).toHaveLength(2);
  });

  test('sorts by the x-axis directly when it is the chosen key', () => {
    const queryContext = buildQuery({
      ...formData,
      x_axis_sort: 'bar',
      x_axis_sort_asc: false,
    } as unknown as SqlaFormData);
    const [query] = queryContext.queries;
    // already in the GROUP BY, so order by the column itself
    expect(query.orderby?.[0]).toEqual(['bar', false]);
    expect(query.columns).toHaveLength(2);
  });

  test('sorts by the breakdown directly when it is the chosen key', () => {
    const queryContext = buildQuery({
      ...formData,
      x_axis_sort: 'baz',
      x_axis_sort_asc: true,
    } as unknown as SqlaFormData);
    const [query] = queryContext.queries;
    expect(query.orderby?.[0]).toEqual(['baz', true]);
    expect(query.columns).toHaveLength(2);
  });

  test('treats an adhoc x-axis as already grouped', () => {
    const queryContext = buildQuery({
      ...formData,
      x_axis: {
        label: 'derived',
        sqlExpression: 'UPPER(bar)',
        expressionType: 'SQL',
      },
      x_axis_sort: 'derived',
      x_axis_sort_asc: true,
    } as unknown as SqlaFormData);
    const [query] = queryContext.queries;
    // matched by label, so it must not be aggregate-wrapped
    expect(query.orderby?.[0]).toEqual(['derived', true]);
    expect(query.columns).toHaveLength(2);
  });
});
