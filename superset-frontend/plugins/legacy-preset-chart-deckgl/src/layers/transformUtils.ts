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
import { ChartProps, getMetricLabel } from '@superset-ui/core';
import { getMapboxApiKey, DataRecord } from './spatialUtils';

const NOOP = () => {};

export interface BaseHooks {
  onAddFilter: ChartProps['hooks']['onAddFilter'];
  onContextMenu: ChartProps['hooks']['onContextMenu'];
  setControlValue: ChartProps['hooks']['setControlValue'];
  setDataMask: ChartProps['hooks']['setDataMask'];
}

export interface BaseTransformPropsResult {
  datasource: ChartProps['datasource'];
  emitCrossFilters: ChartProps['emitCrossFilters'];
  formData: ChartProps['rawFormData'];
  height: ChartProps['height'];
  onAddFilter: ChartProps['hooks']['onAddFilter'];
  onContextMenu: ChartProps['hooks']['onContextMenu'];
  payload: {
    data: {
      features: unknown[];
      mapboxApiKey: string;
      metricLabels?: string[];
    };
    [key: string]: unknown;
  };
  setControlValue: ChartProps['hooks']['setControlValue'];
  filterState: ChartProps['filterState'];
  viewport: {
    height: number;
    width: number;
    [key: string]: unknown;
  };
  width: ChartProps['width'];
  setDataMask: ChartProps['hooks']['setDataMask'];
  setTooltip: () => void;
}

export function extractHooks(hooks: ChartProps['hooks']): BaseHooks {
  return {
    onAddFilter: hooks?.onAddFilter || NOOP,
    onContextMenu: hooks?.onContextMenu || NOOP,
    setControlValue: hooks?.setControlValue || NOOP,
    setDataMask: hooks?.setDataMask || NOOP,
  };
}

export function createBaseTransformResult(
  chartProps: ChartProps,
  features: unknown[],
  metricLabels?: string[],
): BaseTransformPropsResult {
  const {
    datasource,
    height,
    queriesData,
    rawFormData: formData,
    width,
    filterState,
    emitCrossFilters,
  } = chartProps;

  const hooks = extractHooks(chartProps.hooks);
  const queryData = queriesData[0];

  return {
    datasource,
    emitCrossFilters,
    formData,
    height,
    ...hooks,
    payload: {
      ...queryData,
      data: {
        features,
        mapboxApiKey: getMapboxApiKey(),
        metricLabels: metricLabels || [],
      },
    },
    filterState,
    viewport: {
      ...formData.viewport,
      height,
      width,
    },
    width,
    setTooltip: NOOP,
  };
}

export function getRecordsFromQuery(
  queriesData: ChartProps['queriesData'],
): DataRecord[] {
  return queriesData[0]?.data || [];
}

export function parseMetricValue(value: unknown): number | undefined {
  if (value == null) return undefined;
  const parsed = parseFloat(String(value));
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function addPropertiesToFeature<T extends Record<string, unknown>>(
  feature: T,
  record: DataRecord,
  excludeKeys: Set<string>,
): T {
  const result = { ...feature } as Record<string, unknown>;
  Object.keys(record).forEach(key => {
    if (!excludeKeys.has(key)) {
      result[key] = record[key];
    }
  });
  return result as T;
}

export function getMetricLabelFromFormData(
  metric: string | { value?: string } | undefined,
): string | undefined {
  if (!metric) return undefined;
  if (typeof metric === 'string') return getMetricLabel(metric);
  return metric.value ? getMetricLabel(metric.value) : undefined;
}
