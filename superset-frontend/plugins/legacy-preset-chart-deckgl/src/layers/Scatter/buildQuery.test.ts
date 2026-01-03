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

test('Scatter buildQuery should convert numeric metric value to string', () => {
  const formData: DeckScatterFormData = {
    ...baseFormData,
    point_radius_fixed: {
      type: 'metric',
      value: 123, // numeric metric (edge case)
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toContain('123');
  expect(query.orderby).toEqual([['123', false]]);
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
