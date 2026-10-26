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
import { SupersetTheme } from '@apache-superset/core/theme';
import { ChartProps } from '@superset-ui/core';
import { isEqual } from 'lodash-es';
import { ChartConfig, ChartConfigFeature, ChartTransformer } from '../types';
import ChartWrapper from '../components/ChartWrapper';

/**
 * Create a chart component for a location.
 *
 * @param chartVizType The superset visualization type
 * @param chartConfig The untransformed chart configuration
 * @param chartWidth The chart width
 * @param chartHeight The chart height
 * @param chartTheme The chart theme
 * @param chartLocale The chart locale
 * @param chartTransformer The embedded chart transformer
 * @returns The chart as React component
 */
export const createChartComponent = (
  chartVizType: string,
  chartConfig: ChartConfigFeature,
  chartWidth: number,
  chartHeight: number,
  chartTheme: SupersetTheme,
  chartLocale: string,
  chartTransformer?: ChartTransformer,
) => {
  if (
    !chartTransformer ||
    !Number.isFinite(chartWidth) ||
    !Number.isFinite(chartHeight) ||
    chartWidth <= 0 ||
    chartHeight <= 0
  ) {
    return null;
  }

  try {
    const properties = chartTransformer({
      ...chartConfig.properties,
      width: chartWidth,
      height: chartHeight,
      theme: chartTheme,
    } as ChartProps);

    return (
      <ChartWrapper
        vizType={chartVizType}
        chartConfig={{ ...chartConfig, properties }}
        width={chartWidth}
        height={chartHeight}
        theme={chartTheme}
        locale={chartLocale}
      />
    );
  } catch {
    return null;
  }
};

/**
 * Simplifies a chart configuration by removing render-time dimensions and refs.
 *
 * @param config The chart configuration to simplify.
 * @returns The simplified chart configuration.
 */
export const simplifyConfig = (config: ChartConfig) => {
  const simplifiedConfig: ChartConfig = {
    type: config.type,
    features: config.features.map(f => ({
      type: f.type,
      geometry: f.geometry,
      properties: Object.keys(f.properties)
        .filter(k => !['refs', 'width', 'height'].includes(k))
        .reduce((prev, cur) => ({ ...prev, [cur]: f.properties[cur] }), {}),
    })),
  };
  return simplifiedConfig;
};

/**
 * Check if two chart configurations are equal (deep equality).
 *
 * @param configA The first chart config for comparison.
 * @param configB The second chart config for comparison.
 * @returns True, if configurations are equal. False otherwise.
 */
export const isChartConfigEqual = (
  configA: ChartConfig,
  configB: ChartConfig,
) => {
  const simplifiedConfigA = simplifyConfig(configA);
  const simplifiedConfigB = simplifyConfig(configB);
  return isEqual(simplifiedConfigA, simplifiedConfigB);
};
