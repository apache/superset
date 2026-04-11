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
import { PostProcessingRule, QueryFormData } from '@superset-ui/core';
import buildQuery from '../../src/Heatmap/buildQuery';

const isRankOperation = (op?: PostProcessingRule) => op?.operation === 'rank';

describe('Heatmap buildQuery - X-axis sort orderby', () => {
  const baseFormData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    metric: 'count',
    x_axis: 'category',
    groupby: ['region'],
    viz_type: 'heatmap',
  } as QueryFormData;

  test('should NOT add orderby when sort_x_axis is value-based ascending', () => {
    const formData = { ...baseFormData, sort_x_axis: 'value_asc' };
    const [query] = buildQuery(formData).queries;
    expect(query.orderby).toEqual([]);
  });

  test('should NOT add orderby when sort_x_axis is value-based descending', () => {
    const formData = { ...baseFormData, sort_x_axis: 'value_desc' };
    const [query] = buildQuery(formData).queries;
    expect(query.orderby).toEqual([]);
  });

  test('should add column orderby when sort_x_axis is alpha ascending', () => {
    const formData = { ...baseFormData, sort_x_axis: 'alpha_asc' };
    const [query] = buildQuery(formData).queries;
    expect(query.orderby).toEqual([['category', true]]);
  });

  test('should add column orderby when sort_x_axis is alpha descending', () => {
    const formData = { ...baseFormData, sort_x_axis: 'alpha_desc' };
    const [query] = buildQuery(formData).queries;
    expect(query.orderby).toEqual([['category', false]]);
  });

  test('should produce no orderby entries when sort_x_axis is not set', () => {
    const formData = { ...baseFormData };
    const [query] = buildQuery(formData).queries;
    expect(query.orderby).toEqual([]);
  });
});

describe('Heatmap buildQuery - Y-axis sort orderby', () => {
  const baseFormData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    metric: 'count',
    x_axis: 'category',
    groupby: ['region'],
    viz_type: 'heatmap',
  } as QueryFormData;

  test('should NOT add orderby when sort_y_axis is value-based ascending', () => {
    const formData = { ...baseFormData, sort_y_axis: 'value_asc' };
    const [query] = buildQuery(formData).queries;
    expect(query.orderby).toEqual([]);
  });

  test('should NOT add orderby when sort_y_axis is value-based descending', () => {
    const formData = { ...baseFormData, sort_y_axis: 'value_desc' };
    const [query] = buildQuery(formData).queries;
    expect(query.orderby).toEqual([]);
  });

  test('should add column orderby when sort_y_axis is alpha ascending', () => {
    const formData = { ...baseFormData, sort_y_axis: 'alpha_asc' };
    const [query] = buildQuery(formData).queries;
    expect(query.orderby).toEqual([['region', true]]);
  });

  test('should add column orderby when sort_y_axis is alpha descending', () => {
    const formData = { ...baseFormData, sort_y_axis: 'alpha_desc' };
    const [query] = buildQuery(formData).queries;
    expect(query.orderby).toEqual([['region', false]]);
  });

  test('should produce no orderby entries when sort_y_axis is not set', () => {
    const formData = { ...baseFormData };
    const [query] = buildQuery(formData).queries;
    expect(query.orderby).toEqual([]);
  });
});

describe('Heatmap buildQuery - Rank Operation for Normalized Field', () => {
  const baseFormData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    metric: 'count',
    x_axis: 'category',
    groupby: ['region'],
    viz_type: 'heatmap',
  } as QueryFormData;

  test('should ALWAYS include rank operation when normalized=true', () => {
    const formData = {
      ...baseFormData,
      normalized: true,
    };

    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;

    const rankOperation = query.post_processing?.find(isRankOperation);

    expect(rankOperation).toBeDefined();
    expect(rankOperation?.operation).toBe('rank');
  });

  test('should ALWAYS include rank operation when normalized=false', () => {
    const formData = {
      ...baseFormData,
      normalized: false,
    };

    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;

    const rankOperation = query.post_processing?.find(isRankOperation);

    expect(rankOperation).toBeDefined();
    expect(rankOperation?.operation).toBe('rank');
  });

  test('should ALWAYS include rank operation when normalized is undefined', () => {
    const formData = {
      ...baseFormData,
      // normalized not set
    };

    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;

    const rankOperation = query.post_processing?.find(isRankOperation);

    expect(rankOperation).toBeDefined();
    expect(rankOperation?.operation).toBe('rank');
  });
});
