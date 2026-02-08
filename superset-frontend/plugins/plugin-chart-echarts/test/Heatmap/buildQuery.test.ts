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
import buildQuery from '../../src/Heatmap/buildQuery';

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

    const rankOperation = query.post_processing?.find(
      op => op?.operation === 'rank',
    );

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

    const rankOperation = query.post_processing?.find(
      op => op?.operation === 'rank',
    );

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

    const rankOperation = query.post_processing?.find(
      op => op?.operation === 'rank',
    );

    expect(rankOperation).toBeDefined();
    expect(rankOperation?.operation).toBe('rank');
  });
});
