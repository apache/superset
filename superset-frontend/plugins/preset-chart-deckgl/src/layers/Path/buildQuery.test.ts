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
import buildQuery, { DeckPathFormData } from './buildQuery';

const baseFormData: DeckPathFormData = {
  datasource: '1__table',
  viz_type: 'deck_path',
  line_column: 'path_json',
  line_type: 'json',
  row_limit: 100,
};

test('Path buildQuery should not include metric when line_width is fixed type', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    line_width: {
      type: 'fix',
      value: 5,
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toEqual([]);
});

test('Path buildQuery should handle numeric line_width value with fixed type', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    line_width: {
      type: 'fix',
      value: 5,
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toEqual([]);
});

test('Path buildQuery should handle missing line_width', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toEqual([]);
});

test('Path buildQuery should include metric when line_width is metric type', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    line_width: {
      type: 'metric',
      value: 'COUNT(*)',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toContain('COUNT(*)');
});

test('Path buildQuery should add line_column to groupby when using width metric', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    line_width: {
      type: 'metric',
      value: 'SUM(distance)',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.groupby).toContain('path_json');
});

test('Path buildQuery should handle adhoc SQL metric for line_width', () => {
  const adhocMetric = {
    label: 'custom_width',
    expressionType: 'SQL' as const,
    sqlExpression: 'SUM(weight) / COUNT(*)',
  };
  const formData: DeckPathFormData = {
    ...baseFormData,
    line_width: {
      type: 'metric',
      value: adhocMetric,
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toContainEqual(adhocMetric);
});

test('Path buildQuery should handle adhoc SIMPLE metric for line_width', () => {
  const adhocMetric = {
    label: 'AVG(traffic)',
    expressionType: 'SIMPLE' as const,
    column: { column_name: 'traffic' },
    aggregate: 'AVG' as const,
  };
  const formData: DeckPathFormData = {
    ...baseFormData,
    line_width: {
      type: 'metric',
      value: adhocMetric,
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toContainEqual(adhocMetric);
});

test('Path buildQuery should handle metric type with undefined value', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    line_width: {
      type: 'metric',
      value: undefined,
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toEqual([]);
});

test('Path buildQuery should not duplicate width metric if already in metrics', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    metrics: ['AVG(weight)'],
    line_width: {
      type: 'metric',
      value: 'AVG(weight)',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toHaveLength(1);
});

test('Path buildQuery should preserve existing metrics when adding width metric', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    metrics: ['COUNT(*)'],
    line_width: {
      type: 'metric',
      value: 'AVG(weight)',
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toContain('COUNT(*)');
  expect(query.metrics).toContain('AVG(weight)');
  expect(query.metrics).toHaveLength(2);
});

test('Path buildQuery should not modify existing metrics for fixed width', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    metrics: ['COUNT(*)', 'SUM(value)'],
    line_width: {
      type: 'fix',
      value: 5,
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toEqual(['COUNT(*)', 'SUM(value)']);
});

test('Path buildQuery should handle undefined value in metric type gracefully', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    line_width: {
      type: 'metric',
      value: undefined,
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  // Should not add anything when value is undefined
  expect(query.metrics).toEqual([]);
});

test('Path buildQuery should handle line_width with undefined type', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    line_width: {
      type: undefined,
      value: 2,
    },
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toEqual([]);
});

// ─── Dimension (categorical color) ───

test('Path buildQuery should include dimension column when specified', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    dimension: 'route_type',
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.columns).toContain('route_type');
});

test('Path buildQuery should include breakpoint_metric when specified', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    breakpoint_metric: 'AVG(speed)',
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toContain('AVG(speed)');
});

test('Path buildQuery should add line_column to groupby when using breakpoint metric', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    breakpoint_metric: 'AVG(speed)',
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.groupby).toContain('path_json');
});

test('Path buildQuery should not duplicate breakpoint metric if already in metrics', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    metrics: ['AVG(speed)'],
    breakpoint_metric: 'AVG(speed)',
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toHaveLength(1);
  expect(query.metrics).toContain('AVG(speed)');
});

test('Path buildQuery should handle breakpoint_metric and line_width metric together', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    line_width: {
      type: 'metric',
      value: 'SUM(distance)',
    },
    breakpoint_metric: 'AVG(speed)',
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toContain('SUM(distance)');
  expect(query.metrics).toContain('AVG(speed)');
});

test('Path buildQuery should handle adhoc breakpoint metric', () => {
  const adhocMetric = {
    label: 'avg_speed',
    expressionType: 'SQL' as const,
    sqlExpression: 'AVG(speed_mph)',
  };
  const formData: DeckPathFormData = {
    ...baseFormData,
    breakpoint_metric: adhocMetric,
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toContainEqual(adhocMetric);
});

test('Path buildQuery should handle missing breakpoint_metric', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toEqual([]);
});

test('Path buildQuery should handle line_width and breakpoint_metrics together together', () => {
  const formData: DeckPathFormData = {
    ...baseFormData,
    line_width: {
      type: 'metric',
      value: 'SUM(distance)',
    },
    breakpoint_metric: 'AVG(speed)',
    js_columns: ['color'],
    tooltip_contents: ['name'],
    row_limit: 500,
  };

  const queryContext = buildQuery(formData);
  const [query] = queryContext.queries;

  expect(query.metrics).toContain('SUM(distance)');
  expect(query.metrics).toContain('AVG(speed)');
  expect(query.columns).toContain('color');
  expect(query.columns).toContain('name');
  expect(query.row_limit).toBe(500);
});
