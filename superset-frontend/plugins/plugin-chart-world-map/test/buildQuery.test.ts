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
import buildQuery, { WorldMapFormData } from '../src/buildQuery';

const baseFormData: WorldMapFormData = {
  datasource: '5__table',
  viz_type: 'world_map',
  entity: 'country_code',
  metric: 'count',
};

describe('WorldMap buildQuery', () => {
  test('groups by the entity column and queries the metric', () => {
    const queryContext = buildQuery(baseFormData);
    const [query] = queryContext.queries;
    expect(query.columns).toEqual(['country_code']);
    expect(query.metrics).toEqual(['count']);
    expect(query.orderby).toBeUndefined();
  });

  test('adds a distinct secondary metric', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      secondary_metric: 'sum__population',
    });
    const [query] = queryContext.queries;
    expect(query.metrics).toEqual(['count', 'sum__population']);
  });

  test('does not duplicate a secondary metric equal to the metric', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      secondary_metric: 'count',
    });
    const [query] = queryContext.queries;
    expect(query.metrics).toEqual(['count']);
  });

  test('compares metrics by label for adhoc metrics', () => {
    const adhocMetric = {
      expressionType: 'SQL' as const,
      sqlExpression: 'COUNT(*)',
      label: 'count',
    };
    const queryContext = buildQuery({
      ...baseFormData,
      metric: adhocMetric,
      secondary_metric: { ...adhocMetric },
    });
    const [query] = queryContext.queries;
    expect(query.metrics).toEqual([adhocMetric]);
  });

  test('orders by the metric when sort_by_metric is enabled', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      sort_by_metric: true,
    });
    const [query] = queryContext.queries;
    expect(query.orderby).toEqual([['count', false]]);
  });
});
