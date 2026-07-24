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

  test('sorts by a custom column and selects it so ORDER BY can reference it', () => {
    const queryContext = buildQuery({
      ...formData,
      x_axis_sort: 'sort_order',
      x_axis_sort_asc: true,
    } as unknown as SqlaFormData);
    const [query] = queryContext.queries;
    // custom sort leads, category grouping columns follow
    expect(query.orderby?.[0]).toEqual(['sort_order', true]);
    // the sort column is added to the selected columns
    expect(query.columns).toContain('sort_order');
  });

  test('respects descending order', () => {
    const queryContext = buildQuery({
      ...formData,
      x_axis_sort: 'sort_order',
      x_axis_sort_asc: false,
    } as unknown as SqlaFormData);
    const [query] = queryContext.queries;
    expect(query.orderby?.[0]).toEqual(['sort_order', false]);
  });

  test('does not re-add a metric sort key to the selected columns', () => {
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
});
