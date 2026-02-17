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
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/ui';
import transformProps from '../../src/Sankey/transformProps';
import { SankeyChartProps } from '../../src/Sankey/types';

describe('Sankey transformProps', () => {
  const baseFormData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    metric: 'sum__value',
    source: 'source_col',
    target: 'target_col',
  };

  const baseQueryResult = {
    data: [
      { source_col: 'A', target_col: 'B', sum__value: 100 },
      { source_col: 'A', target_col: 'C', sum__value: 200 },
      { source_col: 'B', target_col: 'D', sum__value: 50 },
    ],
  };

  const createChartProps = (overrides = {}) =>
    new ChartProps({
      formData: baseFormData,
      width: 800,
      height: 600,
      queriesData: [baseQueryResult],
      theme: supersetTheme,
      ...overrides,
    });

  test('should transform chart props for viz', () => {
    const chartProps = createChartProps();
    const result = transformProps(chartProps as SankeyChartProps);

    expect(result).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: expect.objectContaining({
            type: 'sankey',
            links: expect.arrayContaining([
              expect.objectContaining({ source: 'A', target: 'B', value: 100 }),
            ]),
          }),
        }),
      }),
    );
  });

  describe('metric label localization', () => {
    const adhocMetricWithTranslation = {
      expressionType: 'SQL',
      sqlExpression: 'SUM(value)',
      label: 'Total Count',
      hasCustomLabel: true,
      translations: {
        label: {
          de: 'Gesamtzahl',
          ru: 'Общее количество',
        },
      },
    };

    const localizationFormData = {
      ...baseFormData,
      metric: adhocMetricWithTranslation,
    };

    const localizationQueryResult = {
      data: [
        { source_col: 'A', target_col: 'B', 'Total Count': 100 },
        { source_col: 'A', target_col: 'C', 'Total Count': 200 },
        { source_col: 'B', target_col: 'D', 'Total Count': 50 },
      ],
    };

    test('should use localized metric label in tooltip when locale has translation', () => {
      const chartProps = createChartProps({
        formData: localizationFormData,
        queriesData: [localizationQueryResult],
        locale: 'de',
      });

      const result = transformProps(chartProps as SankeyChartProps);

      // Get the tooltip formatter
      const tooltipFormatter = (result.echartOptions.tooltip as { formatter?: Function })?.formatter;
      expect(tooltipFormatter).toBeDefined();

      // Call the formatter with mock params to verify it uses localized label
      const mockParams = {
        name: 'A → B',
        value: 100,
        data: { source: 'A', target: 'B', value: 100 },
      };
      const tooltipHtml = (tooltipFormatter as Function)(mockParams);

      // Should contain the German translation "Gesamtzahl", not "Total Count"
      expect(tooltipHtml).toContain('Gesamtzahl');
      expect(tooltipHtml).not.toContain('Total Count');
    });

    test('should fall back to default label when locale has no translation', () => {
      const chartProps = createChartProps({
        formData: localizationFormData,
        queriesData: [localizationQueryResult],
        locale: 'fr', // French - no translation provided
      });

      const result = transformProps(chartProps as SankeyChartProps);

      const tooltipFormatter = (result.echartOptions.tooltip as { formatter?: Function })?.formatter;
      const mockParams = {
        name: 'A → B',
        value: 100,
        data: { source: 'A', target: 'B', value: 100 },
      };
      const tooltipHtml = (tooltipFormatter as Function)(mockParams);

      // Should fall back to default label "Total Count"
      expect(tooltipHtml).toContain('Total Count');
    });

    test('should use default label when no locale is provided', () => {
      const chartProps = createChartProps({
        formData: localizationFormData,
        queriesData: [localizationQueryResult],
        // No locale provided
      });

      const result = transformProps(chartProps as SankeyChartProps);

      const tooltipFormatter = (result.echartOptions.tooltip as { formatter?: Function })?.formatter;
      const mockParams = {
        name: 'A → B',
        value: 100,
        data: { source: 'A', target: 'B', value: 100 },
      };
      const tooltipHtml = (tooltipFormatter as Function)(mockParams);

      // Should use default label "Total Count"
      expect(tooltipHtml).toContain('Total Count');
    });
  });
});
