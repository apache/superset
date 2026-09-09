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
import { QueryFormData } from '@superset-ui/core';
import buildQuery from './buildQuery';

describe('BigNumberYoyMom buildQuery', () => {
  const baseFormData: QueryFormData = {
    datasource: '1__table',
    viz_type: 'big_number_yoy_mom',
    metric: 'value',
  };

  test('sets time_offsets from both comparison slots', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      time_range: 'Last week',
      comparison1_offset: '1 month ago',
      comparison2_offset: '1 year ago',
    });
    expect(queryContext.queries[0].time_offsets).toEqual([
      '1 month ago',
      '1 year ago',
    ]);
  });

  test('omits empty comparison offsets', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      time_range: 'Last week',
      comparison1_offset: '1 month ago',
    });
    expect(queryContext.queries[0].time_offsets).toEqual(['1 month ago']);
  });

  test('returns empty time_offsets when no comparison is configured', () => {
    const queryContext = buildQuery(baseFormData);
    expect(queryContext.queries[0].time_offsets).toEqual([]);
  });

  test('expands an open-ended time range when a comparison is active', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      time_range: 'Previous week',
      comparison1_offset: '1 month ago',
    });
    expect(queryContext.queries[0].time_range).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} : \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    );
  });

  test('keeps the time range untouched when no comparison is active', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      time_range: 'Previous week',
    });
    expect(queryContext.queries[0].time_range).toBe('Previous week');
  });

  test('keeps a backend-resolved range untouched when a comparison is active', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      time_range: 'Last week',
      comparison1_offset: '1 month ago',
    });
    expect(queryContext.queries[0].time_range).toBe('Last week');
  });

  test('reads comparison values from columns and sends no time offsets', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      time_range: 'No filter',
      comparison1_offset: '1 month ago',
      comparison1_column: 'prev_month_sales',
      comparison2_column: 'prev_year_sales',
    });
    expect(queryContext.queries[0].time_offsets).toEqual([]);
    expect(queryContext.queries[0].time_range).toBe('No filter');
    expect(queryContext.queries[0].metrics).toEqual(
      expect.arrayContaining(['prev_month_sales', 'prev_year_sales']),
    );
  });

  test('drops time offsets when the time range is "No filter"', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      time_range: 'No filter',
      comparison1_offset: '1 month ago',
      comparison2_offset: '1 year ago',
    });
    expect(queryContext.queries[0].time_offsets).toEqual([]);
    expect(queryContext.queries[0].time_range).toBe('No filter');
  });

  test('splits into a point series query for "No filter" time shifts', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      time_range: 'No filter',
      granularity_sqla: 'report_date',
      comparison1_offset: '1 month ago',
      comparison2_offset: '1 year ago',
    });
    expect(queryContext.queries).toHaveLength(2);
    expect(queryContext.queries[0].time_offsets).toEqual([]);
    expect(queryContext.queries[0].time_range).toBe('No filter');
    expect(queryContext.queries[1].metrics).toEqual(expect.arrayContaining(['value']));
    expect(queryContext.queries[1].groupby).toEqual(['report_date']);
    expect(queryContext.queries[1].orderby).toEqual([['report_date', false]]);
    expect(queryContext.queries[1].time_offsets).toEqual([]);
    expect(queryContext.queries[1].row_limit).toBeGreaterThanOrEqual(30);
  });

  test('keeps a single query when no time column is set for a point comparison', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      time_range: 'No filter',
      comparison1_offset: '1 month ago',
    });
    expect(queryContext.queries).toHaveLength(1);
    expect(queryContext.queries[0].time_offsets).toEqual([]);
  });

  test('groups the point series by an adhoc time column expression', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      time_range: 'No filter',
      granularity_sqla: {
        expressionType: 'SQL',
        sqlExpression: "STR_TO_DATE(CONCAT(CAST(report_date AS CHAR),'01'),'%Y%m%d')",
        label: 'report_date_expr',
      },
      comparison1_offset: '1 month ago',
    });
    expect(queryContext.queries).toHaveLength(2);
    expect(queryContext.queries[1].groupby).toEqual([
      expect.objectContaining({
        sqlExpression: expect.stringContaining('STR_TO_DATE'),
      }),
    ]);
    expect(queryContext.queries[1].granularity).toBeUndefined();
  });

  test('keeps time offsets and enclosed range for a closed time range', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      time_range: 'Last week',
      granularity_sqla: 'report_date',
      comparison1_offset: '1 month ago',
    });
    expect(queryContext.queries).toHaveLength(1);
    expect(queryContext.queries[0].time_offsets).toEqual(['1 month ago']);
    expect(queryContext.queries[0].time_range).toBe('Last week');
  });

  test('drops a slot that configures a value column from time offsets', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      time_range: 'Last week',
      comparison1_offset: '1 month ago',
      comparison1_column: 'prev_month_sales',
      comparison2_offset: '1 year ago',
    });
    expect(queryContext.queries[0].time_offsets).toEqual(['1 year ago']);
    expect(queryContext.queries[0].metrics).toEqual(
      expect.arrayContaining(['prev_month_sales']),
    );
  });

  test('deduplicates a comparison metric sharing the main metric label', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      metric: 'COUNT(*)',
      time_range: 'No filter',
      comparison1_column: 'COUNT(*)',
      comparison1_mode: 'metric',
      comparison2_column: 'prev_year_sales',
      comparison2_mode: 'metric',
    });
    expect(queryContext.queries[0].metrics).toEqual(
      expect.arrayContaining(['COUNT(*)', 'prev_year_sales']),
    );
    // COUNT(*) is requested only once despite being configured twice.
    const countOccurrences = queryContext.queries[0].metrics.filter(
      metric => metric === 'COUNT(*)',
    );
    expect(countOccurrences).toHaveLength(1);
  });

  test('deduplicates two comparison metrics sharing a label', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      metric: 'value',
      time_range: 'No filter',
      comparison1_column: 'moom_value',
      comparison1_mode: 'metric',
      comparison2_column: { expressionType: 'SQL', sqlExpression: 'SUM(x)', label: 'moom_value' },
      comparison2_mode: 'metric',
    });
    const metrics = queryContext.queries[0].metrics as unknown[];
    expect(metrics.filter(m => String(m).includes('moom_value'))).toHaveLength(1);
  });

  test('downgrades an adhoc time column to a query column', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      granularity_sqla: {
        expressionType: 'SQL',
        sqlExpression: "STR_TO_DATE(CONCAT(CAST(report_date AS CHAR),'01'),'%Y%m%d')",
        label: 'report_date_expr',
      },
    });
    expect(queryContext.queries[0].granularity).toBeUndefined();
    expect(queryContext.queries[0].columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sqlExpression: expect.stringContaining('STR_TO_DATE') }),
      ]),
    );
  });

  test('keeps a physical time column as granularity', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      granularity_sqla: 'created_at',
    });
    expect(queryContext.queries[0].granularity).toBe('created_at');
  });
});
