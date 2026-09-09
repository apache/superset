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
});
