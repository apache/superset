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

import buildQuery, { DeckScatterFormData } from './buildQuery';

const baseFormData: DeckScatterFormData = {
  datasource: '1__table',
  viz_type: 'deck_scatter',
  spatial: {
    type: 'latlong',
    latCol: 'LATITUDE',
    lonCol: 'LONGITUDE',
  },
  row_limit: 100,
};

test('Scatter buildQuery should not include metric when point_radius_fixed is fixed type', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    point_radius_fixed: {
      type: 'fix',
      value: '1000',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toEqual([]);
  expect(query.orderby).toEqual([]);
});

test('Scatter buildQuery should include metric when point_radius_fixed is metric type', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    point_radius_fixed: {
      type: 'metric',
      value: 'AVG(radius_value)',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toContain('AVG(radius_value)');
  expect(query.orderby).toEqual([['AVG(radius_value)', false]]);
});

test('Scatter buildQuery should handle numeric value in fixed type', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    point_radius_fixed: {
      type: 'fix',
      value: 500,
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  // Fixed numeric value should not be included as a metric
  expect(query.metrics).toEqual([]);
  expect(query.orderby).toEqual([]);
});

test('Scatter buildQuery should handle missing point_radius_fixed', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    // no point_radius_fixed
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toEqual([]);
  expect(query.orderby).toEqual([]);
});

test('Scatter buildQuery should include spatial columns in query', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    point_radius_fixed: {
      type: 'fix',
      value: '1000',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.columns).toContain('LATITUDE');
  expect(query.columns).toContain('LONGITUDE');
});

test('Scatter buildQuery should include dimension column when specified', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    dimension: 'category',
    point_radius_fixed: {
      type: 'fix',
      value: '1000',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.columns).toContain('category');
});

test('Scatter buildQuery should add spatial null filters', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    point_radius_fixed: {
      type: 'fix',
      value: '1000',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  const latFilter = query.filters?.find(
    f => f.col === 'LATITUDE' && f.op === 'IS NOT NULL',
  );
  const lonFilter = query.filters?.find(
    f => f.col === 'LONGITUDE' && f.op === 'IS NOT NULL',
  );

  expect(latFilter).toBeDefined();
  expect(lonFilter).toBeDefined();
});

test('Scatter buildQuery should throw error when spatial is missing', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    spatial: undefined,
  };

  expect(() => buildQuery(formData)).toThrow(
    'Spatial configuration is required for Scatter charts',
  );
});

test('Scatter buildQuery should handle geohash spatial type', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    spatial: {
      type: 'geohash',
      geohashCol: 'geohash_column',
    },
    point_radius_fixed: {
      type: 'metric',
      value: 'COUNT(*)',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.columns).toContain('geohash_column');
  expect(query.metrics).toContain('COUNT(*)');
});

test('Scatter buildQuery should handle tooltip_contents', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    tooltip_contents: ['name', 'description'],
    point_radius_fixed: {
      type: 'fix',
      value: '1000',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.columns).toContain('name');
  expect(query.columns).toContain('description');
});

test('Scatter buildQuery should handle js_columns', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    js_columns: ['custom_col1', 'custom_col2'],
    point_radius_fixed: {
      type: 'fix',
      value: '1000',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.columns).toContain('custom_col1');
  expect(query.columns).toContain('custom_col2');
});

test('Scatter buildQuery should handle adhoc SQL metric for point_radius_fixed', () => {
  const adhocMetric = {
    label: 'count(*) * 1.1',
    expressionType: 'SQL' as const,
    sqlExpression: 'count(*) * 1.1',
  };
  const formData: DeckScatterFormData = {
    ...baseFormData,
    point_radius_fixed: {
      type: 'metric',
      value: adhocMetric,
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  // Should preserve full adhoc metric object (not just the label string)
  expect(query.metrics).toContainEqual(adhocMetric);
  // orderby should use the label string
  expect(query.orderby).toEqual([['count(*) * 1.1', false]]);
});

test('Scatter buildQuery should set is_timeseries to false', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    point_radius_fixed: {
      type: 'fix',
      value: '1000',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.is_timeseries).toBe(false);
});

test('Scatter buildQuery should preserve row_limit', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    row_limit: 5000,
    point_radius_fixed: {
      type: 'fix',
      value: '1000',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.row_limit).toBe(5000);
});

test('Scatter buildQuery should preserve existing metrics when adding radius metric', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    metrics: ['COUNT(*)'],
    point_radius_fixed: {
      type: 'metric',
      value: 'AVG(radius_value)',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toContain('COUNT(*)');
  expect(query.metrics).toContain('AVG(radius_value)');
  expect(query.metrics).toHaveLength(2);
});

test('Scatter buildQuery should not modify existing metrics for fixed radius', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    metrics: ['COUNT(*)', 'SUM(value)'],
    point_radius_fixed: {
      type: 'fix',
      value: '1000',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toEqual(['COUNT(*)', 'SUM(value)']);
});

test('Scatter buildQuery should deduplicate metrics when radius metric already exists', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    metrics: ['COUNT(*)', 'AVG(price)'],
    point_radius_fixed: {
      type: 'metric',
      value: 'AVG(price)',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  // Should not have duplicate AVG(price)
  expect(query.metrics).toEqual(['COUNT(*)', 'AVG(price)']);
  expect(query.metrics).toHaveLength(2);
});

// Comprehensive point_radius_fixed tests to prevent regressions
test('Scatter buildQuery should handle adhoc SIMPLE metric for point_radius_fixed', () => {
  const adhocMetric = {
    label: 'AVG(population)',
    expressionType: 'SIMPLE' as const,
    column: { column_name: 'population' },
    aggregate: 'AVG' as const,
  };
  const formData: DeckScatterFormData = {
    ...baseFormData,
    point_radius_fixed: {
      type: 'metric',
      value: adhocMetric,
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  // Should preserve full adhoc metric object
  expect(query.metrics).toContainEqual(adhocMetric);
  expect(query.orderby).toEqual([['AVG(population)', false]]);
});

test('Scatter buildQuery should deduplicate adhoc metrics with same label', () => {
  const adhocMetric = {
    label: 'custom_count',
    expressionType: 'SQL' as const,
    sqlExpression: 'count(*) * 2',
  };
  const formData: DeckScatterFormData = {
    ...baseFormData,
    metrics: [adhocMetric], // Already has this metric
    point_radius_fixed: {
      type: 'metric',
      value: adhocMetric, // Same metric for radius
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  // Should not duplicate the metric
  expect(query.metrics).toHaveLength(1);
  expect(query.metrics).toContainEqual(adhocMetric);
});

test('Scatter buildQuery should handle fixed type with string value correctly', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    point_radius_fixed: {
      type: 'fix',
      value: '2500',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  // Fixed values should NOT be added to metrics
  expect(query.metrics).toEqual([]);
  expect(query.orderby).toEqual([]);
});

test('Scatter buildQuery should handle undefined value in metric type gracefully', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    point_radius_fixed: {
      type: 'metric',
      value: undefined,
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  // Should not add anything when value is undefined
  expect(query.metrics).toEqual([]);
  expect(query.orderby).toEqual([]);
});

test('Scatter buildQuery should preserve adhoc metric with custom label', () => {
  const adhocMetric = {
    label: 'My Custom Metric',
    expressionType: 'SQL' as const,
    sqlExpression: 'SUM(revenue) / COUNT(*)',
    hasCustomLabel: true,
  };
  const formData: DeckScatterFormData = {
    ...baseFormData,
    point_radius_fixed: {
      type: 'metric',
      value: adhocMetric,
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  // Should preserve full metric including hasCustomLabel
  expect(query.metrics).toContainEqual(adhocMetric);
  expect(query.orderby).toEqual([['My Custom Metric', false]]);
});
