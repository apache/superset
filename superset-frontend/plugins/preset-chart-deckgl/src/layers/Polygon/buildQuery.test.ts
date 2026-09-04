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
import buildQuery, { DeckPolygonFormData } from './buildQuery';

describe('Polygon buildQuery', () => {
  const baseFormData: DeckPolygonFormData = {
    datasource: '1__table',
    viz_type: 'deck_polygon',
    line_column: 'polygon_geom',
  };

  test('should require line_column', () => {
    const formDataWithoutLineColumn = {
      ...baseFormData,
      line_column: undefined,
    };

    expect(() => buildQuery(formDataWithoutLineColumn)).toThrow(
      'Polygon column is required for Polygon charts',
    );
  });

  test('should build basic query with minimal data', () => {
    const queryContext = buildQuery(baseFormData);
    const [query] = queryContext.queries;

    expect(query.columns).toEqual(['polygon_geom']);
    expect(query.metrics).toEqual([]);
    expect(query.is_timeseries).toBe(false);
    expect(query.filters).toEqual([
      {
        col: 'polygon_geom',
        op: 'IS NOT NULL',
      },
    ]);
  });

  test('should include metric in query when provided', () => {
    const formDataWithMetric = {
      ...baseFormData,
      metric: 'population',
    };

    const queryContext = buildQuery(formDataWithMetric);
    const [query] = queryContext.queries;

    expect(query.metrics).toEqual(['population']);
    expect(query.filters).toContainEqual({
      col: 'population',
      op: 'IS NOT NULL',
    });
  });

  describe('point_radius_fixed legacy structure', () => {
    test('should not add metrics to query when value is simple string', () => {
      const formDataWithFixValue = {
        ...baseFormData,
        point_radius_fixed: {
          value: '1000',
        },
      };

      const queryContext = buildQuery(formDataWithFixValue);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([]);
    });

    test('should not add metrics to query when point_radius_fixed.value is undefined', () => {
      const formDataWithEmptyValue = {
        ...baseFormData,
        point_radius_fixed: {
          value: undefined,
        },
      };

      const queryContext = buildQuery(formDataWithEmptyValue);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([]);
    });

    test('should not add metrics to query when point_radius_fixed is undefined', () => {
      const formDataWithoutFixedRadius = {
        ...baseFormData,
        point_radius_fixed: undefined,
      };

      const queryContext = buildQuery(formDataWithoutFixedRadius);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([]);
    });
  });

  describe('point_radius_fixed "fix" type', () => {
    test('should not add metrics to query when point_radius_fixed type is "fix"', () => {
      const formDataWithFixType = {
        ...baseFormData,
        point_radius_fixed: {
          type: 'fix',
          value: '1000',
        },
      } as any;

      const queryContext = buildQuery(formDataWithFixType);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([]);
    });

    test('should not add metrics to query when point_radius_fixed type is "fix" with zero value', () => {
      const formDataWithZeroFix = {
        ...baseFormData,
        point_radius_fixed: {
          type: 'fix',
          value: '0',
        },
      } as any;

      const queryContext = buildQuery(formDataWithZeroFix);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([]);
    });

    test('should not add metrics to query when point_radius_fixed type is "fix" with decimal value', () => {
      const formDataWithDecimalFix = {
        ...baseFormData,
        point_radius_fixed: {
          type: 'fix',
          value: '500.5',
        },
      } as any;

      const queryContext = buildQuery(formDataWithDecimalFix);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([]);
    });
  });

  describe('point_radius_fixed "metric" type', () => {
    test('should add metric object to query when point_radius_fixed type is "metric"', () => {
      const metricObject = {
        expressionType: 'SQL',
        sqlExpression: 'SUM(population)/SUM(area)',
        column: null,
        aggregate: null,
        datasourceWarning: false,
        hasCustomLabel: false,
        label: 'SUM(population)/SUM(area)',
        optionName: 'metric_c5rvwrzoo86_293h6yrv2ic',
      };

      const formDataWithMetricType = {
        ...baseFormData,
        point_radius_fixed: {
          type: 'metric',
          value: metricObject,
        },
      } as any;

      const queryContext = buildQuery(formDataWithMetricType);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([metricObject]);
    });

    test('should add simple column metric to query when point_radius_fixed type is "metric"', () => {
      const simpleMetricObject = {
        expressionType: 'simple',
        column: {
          column_name: 'avg_elevation',
          type: 'NUMERIC',
        },
        aggregate: 'avg',
        label: 'AVG(avg_elevation)',
      };

      const formDataWithSimpleMetric = {
        ...baseFormData,
        point_radius_fixed: {
          type: 'metric',
          value: simpleMetricObject,
        },
      } as any;

      const queryContext = buildQuery(formDataWithSimpleMetric);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([simpleMetricObject]);
    });

    test('should include both regular metric and point_radius_fixed metric in query when both are specified', () => {
      const metricObject = {
        expressionType: 'simple',
        column: { column_name: 'elevation' },
        aggregate: 'sum',
        label: 'SUM(elevation)',
      };

      const formDataWithBothMetrics = {
        ...baseFormData,
        metric: 'population',
        point_radius_fixed: {
          type: 'metric',
          value: metricObject,
        },
      } as any;

      const queryContext = buildQuery(formDataWithBothMetrics);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual(['population', metricObject]);
    });
  });

  describe('Edge cases and error handling', () => {
    test('should not add metrics to query when point_radius_fixed is null', () => {
      const formDataWithNull = {
        ...baseFormData,
        point_radius_fixed: null,
      } as any;

      const queryContext = buildQuery(formDataWithNull);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([]);
    });

    test('should handle null metric values gracefully', () => {
      const formDataWithNullMetric = {
        ...baseFormData,
        point_radius_fixed: {
          type: 'metric',
          value: null,
        },
      } as any;

      const queryContext = buildQuery(formDataWithNullMetric);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([]);
    });

    test('should handle undefined metric values gracefully', () => {
      const formDataWithUndefinedMetric = {
        ...baseFormData,
        point_radius_fixed: {
          type: 'metric',
          value: undefined,
        },
      } as any;

      const queryContext = buildQuery(formDataWithUndefinedMetric);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([]);
    });

    test('should not add metrics to query when point_radius_fixed is empty object', () => {
      const formDataWithEmptyObject = {
        ...baseFormData,
        point_radius_fixed: {},
      };

      const queryContext = buildQuery(formDataWithEmptyObject);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([]);
    });

    test('should not add metrics to query when point_radius_fixed has unsupported type', () => {
      const formDataWithUnsupportedType = {
        ...baseFormData,
        point_radius_fixed: {
          type: 'unsupported_type',
          value: 'some_value',
        },
      } as any;

      const queryContext = buildQuery(formDataWithUnsupportedType);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([]);
    });

    test('should not add metrics to query when point_radius_fixed has missing type field', () => {
      const formDataWithMissingType = {
        ...baseFormData,
        point_radius_fixed: {
          value: 'some_value',
        },
      };

      const queryContext = buildQuery(formDataWithMissingType);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([]);
    });
  });

  describe('Integration with other form data fields', () => {
    test('should include js_columns in query columns', () => {
      const formDataWithJsColumns = {
        ...baseFormData,
        js_columns: ['custom_col1', 'custom_col2'],
      };

      const queryContext = buildQuery(formDataWithJsColumns);
      const [query] = queryContext.queries;

      expect(query.columns).toEqual([
        'polygon_geom',
        'custom_col1',
        'custom_col2',
      ]);
    });

    test('should include tooltip_contents columns in query', () => {
      const formDataWithTooltips = {
        ...baseFormData,
        tooltip_contents: [
          { item_type: 'column', column_name: 'tooltip_col' },
          'another_tooltip_col',
        ],
      };

      const queryContext = buildQuery(formDataWithTooltips);
      const [query] = queryContext.queries;

      expect(query.columns).toContain('tooltip_col');
      expect(query.columns).toContain('another_tooltip_col');
    });

    test('should not add null filters when filter_nulls is false', () => {
      const formDataWithoutNullFilters = {
        ...baseFormData,
        filter_nulls: false,
        metric: 'population',
      };

      const queryContext = buildQuery(formDataWithoutNullFilters);
      const [query] = queryContext.queries;

      expect(query.filters).toEqual([]);
    });

    test('should build comprehensive query when multiple form data fields are specified', () => {
      const complexFormData = {
        ...baseFormData,
        metric: 'population',
        point_radius_fixed: {
          type: 'metric',
          value: {
            expressionType: 'simple',
            column: { column_name: 'elevation' },
            aggregate: 'avg',
            label: 'AVG(elevation)',
          },
        },
        js_columns: ['custom_prop'],
        tooltip_contents: [
          { item_type: 'column', column_name: 'tooltip_info' },
        ],
        filter_nulls: true,
      } as any;

      const queryContext = buildQuery(complexFormData);
      const [query] = queryContext.queries;

      expect(query.columns).toContain('polygon_geom');
      expect(query.columns).toContain('custom_prop');
      expect(query.columns).toContain('tooltip_info');
      expect(query.metrics).toContain('population');
      expect(query.metrics).toContain(complexFormData.point_radius_fixed.value);
      expect(query.filters).toContainEqual({
        col: 'polygon_geom',
        op: 'IS NOT NULL',
      });
      expect(query.filters).toContainEqual({
        col: 'population',
        op: 'IS NOT NULL',
      });
    });
  });

  describe('Current implementation behavior', () => {
    test('should not add fixed values to metrics for legacy point_radius_fixed structure', () => {
      const formDataWithFix = {
        ...baseFormData,
        point_radius_fixed: {
          value: '1000',
        },
      };

      const queryContext = buildQuery(formDataWithFix);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([]);
    });

    test('should add metric objects to query when point_radius_fixed type is "metric"', () => {
      const metricObject = {
        expressionType: 'SQL',
        sqlExpression: 'AVG(elevation)',
        label: 'AVG(elevation)',
      };

      const formDataWithMetricObject = {
        ...baseFormData,
        point_radius_fixed: {
          type: 'metric',
          value: metricObject,
        },
      } as any;

      const queryContext = buildQuery(formDataWithMetricObject);
      const [query] = queryContext.queries;

      expect(query.metrics).toContain(metricObject);
    });

    test('should respect type information when processing point_radius_fixed', () => {
      const formDataWithTypeInfo = {
        ...baseFormData,
        point_radius_fixed: {
          type: 'fix',
          value: '500',
        },
      } as any;

      const queryContext = buildQuery(formDataWithTypeInfo);
      const [query] = queryContext.queries;

      expect(query.metrics).toEqual([]);
    });
  });
});
