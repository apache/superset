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
import buildQuery from '../../src/Histogram/buildQuery';
import { HistogramFormData } from '../../src/Histogram/types';

const baseFormData: HistogramFormData = {
  datasource: '5__table',
  granularity_sqla: 'ds',
  column: 'price',
  groupby: [],
  bins: 10,
  viz_type: 'histogram',
  cumulative: false,
  normalize: false,
  sliceId: 1,
  showLegend: false,
  showValue: false,
  xAxisFormat: '',
  xAxisTitle: '',
  yAxisFormat: '',
  yAxisTitle: '',
};

test('should build query with column and no metrics', () => {
  const queryContext = buildQuery(baseFormData);
  const [query] = queryContext.queries;
  expect(query.columns).toContain('price');
  expect(query.metrics).toBeUndefined();
});

test('should include groupby columns in query columns', () => {
  const queryContext = buildQuery({ ...baseFormData, groupby: ['category'] });
  const [query] = queryContext.queries;
  expect(query.columns).toEqual(['category', 'price']);
});

test('Regression for #30330: HAVING-clause metric filters require aggregation in the query', () => {
  /**
   * buildQuery unconditionally sets metrics: undefined, which means any
   * HAVING-clause adhoc_filter produces SQL with a HAVING clause but no
   * GROUP BY or aggregated metric — invalid SQL that most databases reject.
   *
   * The fix should preserve (or synthesise) a metric so the HAVING clause
   * has an aggregated value to filter on. This test asserts that desired
   * behaviour: when a HAVING adhoc_filter is present, query.metrics must
   * not be undefined or empty.
   */
  const formDataWithHavingFilter: HistogramFormData = {
    ...baseFormData,
    adhoc_filters: [
      {
        clause: 'HAVING',
        expressionType: 'SQL',
        sqlExpression: 'COUNT(*) > 5',
      },
    ],
  };
  const queryContext = buildQuery(formDataWithHavingFilter);
  const [query] = queryContext.queries;

  // HAVING filters without aggregation produce invalid SQL.
  // The query must include at least one metric when HAVING filters are present.
  expect(query.metrics).toBeDefined();
  expect((query.metrics as unknown[]).length).toBeGreaterThan(0);
});
