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
import {
  AdhocFilter,
  Behavior,
  DataMaskStateWithId,
  EXTRA_FORM_DATA_APPEND_KEYS,
  EXTRA_FORM_DATA_OVERRIDE_KEYS,
  ExtraFormData,
  Filter,
  getChartMetadataRegistry,
  QueryFormData,
  t,
  ExtraFormDataOverride,
  TimeGranularity,
  ExtraFormDataAppend,
} from '@superset-ui/core';
import { LayoutItem } from 'src/dashboard/types';
import extractUrlParams from 'src/dashboard/util/extractUrlParams';
import { isIterable, OnlyKeyWithType } from 'src/utils/types';
import { TAB_TYPE } from '../../util/componentTypes';
import getBootstrapData from '../../../utils/getBootstrapData';

const getDefaultRowLimit = (): number => {
  const bootstrapData = getBootstrapData();
  const nativeFilterDefaultRowLimit =
    bootstrapData?.common?.conf?.NATIVE_FILTER_DEFAULT_ROW_LIMIT;
  return nativeFilterDefaultRowLimit || 1000;
};

export const getFormData = ({
  datasetId,
  dependencies = {},
  groupby,
  defaultDataMask,
  controlValues,
  filterType,
  sortMetric,
  adhoc_filters,
  time_range,
  granularity_sqla,
  type,
  dashboardId,
  id,
}: Partial<Filter> & {
  dashboardId: number;
  datasetId?: number;
  dependencies?: object;
  groupby?: string;
  adhoc_filters?: AdhocFilter[];
  time_range?: string;
}): Partial<QueryFormData> => {
  const otherProps: {
    datasource?: string;
    groupby?: string[];
    sortMetric?: string;
  } = {};
  if (datasetId) {
    otherProps.datasource = `${datasetId}__table`;
  }
  if (groupby) {
    otherProps.groupby = [groupby];
  }
  if (sortMetric) {
    otherProps.sortMetric = sortMetric;
  }
  return {
    ...controlValues,
    ...otherProps,
    adhoc_filters: adhoc_filters ?? [],
    extra_filters: [],
    extra_form_data: dependencies,
    granularity_sqla,
    metrics: ['count'],
    row_limit: getDefaultRowLimit(),
    showSearch: true,
    defaultValue: defaultDataMask?.filterState?.value,
    time_range,
    url_params: extractUrlParams('regular'),
    inView: true,
    viz_type: filterType,
    type,
    dashboardId,
    native_filter_id: id,
  };
};

export function mergeExtraFormData(
  originalExtra: ExtraFormData = {},
  newExtra: ExtraFormData = {},
): ExtraFormData {
  const mergedExtra: ExtraFormData = {};
  EXTRA_FORM_DATA_APPEND_KEYS.forEach((key: string) => {
    const originalExtraData = originalExtra[key as keyof ExtraFormDataAppend];
    const newExtraData = newExtra[key as keyof ExtraFormDataAppend];
    const mergedValues = [
      ...(isIterable(originalExtraData) ? originalExtraData : []),
      ...(isIterable(newExtraData) ? newExtraData : []),
    ];
    if (mergedValues.length) {
      mergedExtra[key as OnlyKeyWithType<ExtraFormData, any[]>] = mergedValues;
    }
  });
  EXTRA_FORM_DATA_OVERRIDE_KEYS.forEach((key: string) => {
    const originalValue = originalExtra[key as keyof ExtraFormDataOverride];
    if (originalValue !== undefined) {
      mergedExtra[key as OnlyKeyWithType<ExtraFormData, typeof originalValue>] =
        originalValue as TimeGranularity;
    }
    const newValue = newExtra[key as keyof ExtraFormDataOverride];
    if (newValue !== undefined) {
      mergedExtra[key as OnlyKeyWithType<ExtraFormData, typeof newValue>] =
        newValue as TimeGranularity;
    }
  });
  return mergedExtra;
}

export function isCrossFilter(vizType: string) {
  // @ts-ignore need export from superset-ui `ItemWithValue`
  return getChartMetadataRegistry().items[vizType]?.value.behaviors?.includes(
    Behavior.InteractiveChart,
  );
}

export function getExtraFormData(
  dataMask: DataMaskStateWithId,
  filterIdsAppliedOnChart: string[],
): ExtraFormData {
  let extraFormData: ExtraFormData = {};
  filterIdsAppliedOnChart.forEach(key => {
    extraFormData = mergeExtraFormData(
      extraFormData,
      dataMask[key]?.extraFormData ?? {},
    );
  });
  return extraFormData;
}

export function nativeFilterGate(behaviors: Behavior[]): boolean {
  return (
    !behaviors.includes(Behavior.NativeFilter) ||
    behaviors.includes(Behavior.InteractiveChart)
  );
}

export const findTabsWithChartsInScope = (
  chartLayoutItems: LayoutItem[],
  chartsInScope: number[],
) =>
  new Set<string>(
    chartsInScope
      .map(chartId =>
        chartLayoutItems
          .find(item => item?.meta?.chartId === chartId)
          ?.parents?.filter(parent => parent.startsWith(`${TAB_TYPE}-`)),
      )
      .filter(id => id !== undefined)
      .flat() as string[],
  );

export const getFilterValueForDisplay = (
  value?: string[] | null | string | number | object,
): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return `${value}`;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return t('Unknown value');
};

export interface FilterTarget {
  type: 'CHART' | 'LAYER';
  chartId: string;
  layerId?: string;
}

export interface FilterScope {
  filterId: string;
  targets: FilterTarget[];
}

// Matches layer keys in format: 'chart-123-layer-456' where 123 is chartId and 456 is layerId
const LAYER_KEY_REGEX = /^chart-(\d+)-layer-(\d+)$/;
// Matches chart keys in format: 'chart-123' where 123 is chartId
const CHART_KEY_REGEX = /^chart-(\d+)$/;

export function parseFilterTarget(scopeKey: string): FilterTarget | null {
  const layerMatch = scopeKey.match(LAYER_KEY_REGEX);
  if (layerMatch) {
    return {
      type: 'LAYER',
      chartId: layerMatch[1],
      layerId: layerMatch[2],
    };
  }

  const chartMatch = scopeKey.match(CHART_KEY_REGEX);
  if (chartMatch) {
    return {
      type: 'CHART',
      chartId: chartMatch[1],
    };
  }

  return null;
}

export function getFilterScope(
  filterId: string,
  filterScopes: Record<string, string[]>,
): FilterScope {
  const scopeKeys = filterScopes[filterId] || [];
  const targets: FilterTarget[] = [];

  scopeKeys.forEach(scopeKey => {
    const target = parseFilterTarget(scopeKey);
    if (target) {
      targets.push(target);
    } else {
      console.warn(`Invalid filter scope key format: ${scopeKey}`);
    }
  });

  return {
    filterId,
    targets,
  };
}

export function aggregateFiltersForTarget(
  dataMask: DataMaskStateWithId,
  filterIds: string[],
): ExtraFormData {
  let aggregatedFormData: ExtraFormData = {};

  filterIds.forEach(filterId => {
    const filterData = dataMask[filterId];
    if (filterData?.extraFormData) {
      aggregatedFormData = mergeExtraFormData(
        aggregatedFormData,
        filterData.extraFormData,
      );
    }
  });

  return aggregatedFormData;
}

function createTargetKey(target: FilterTarget): string {
  if (target.type === 'LAYER') {
    return `${target.chartId}-${target.layerId}`;
  }
  return target.chartId;
}

export function groupFiltersByTarget(
  dataMask: DataMaskStateWithId,
  filterScopes: Record<string, string[]>,
): {
  chartFilters: Map<string, ExtraFormData>;
  layerFilters: Map<string, ExtraFormData>;
} {
  const chartFilters = new Map<string, ExtraFormData>();
  const layerFilters = new Map<string, ExtraFormData>();

  Object.keys(dataMask).forEach(filterId => {
    const scope = getFilterScope(filterId, filterScopes);

    scope.targets.forEach(target => {
      const filterData = dataMask[filterId]?.extraFormData || {};
      const targetKey = createTargetKey(target);

      if (target.type === 'CHART') {
        const existing = chartFilters.get(targetKey) || {};
        chartFilters.set(targetKey, mergeExtraFormData(existing, filterData));
      } else if (target.type === 'LAYER') {
        const existing = layerFilters.get(targetKey) || {};
        layerFilters.set(targetKey, mergeExtraFormData(existing, filterData));
      }
    });
  });

  return { chartFilters, layerFilters };
}

export function buildFilterScopesFromFilters(
  filters: any,
): Record<string, string[]> {
  const filterScopes: Record<string, string[]> = {};

  Object.values(filters).forEach((filter: Filter) => {
    if (filter.chartsInScope) {
      filterScopes[filter.id] = filter.chartsInScope.map(
        (chartId: number) => `chart-${chartId}`,
      );
    }
  });

  return filterScopes;
}

export function getLayerSpecificExtraFormData(
  dataMask: DataMaskStateWithId,
  filterIds: string[],
  chartId: number,
  layerId?: string,
): ExtraFormData {
  let extraFormData: ExtraFormData = {};

  filterIds.forEach(filterId => {
    const filterData = dataMask[filterId];
    if (filterData?.extraFormData) {
      extraFormData = mergeExtraFormData(
        extraFormData,
        filterData.extraFormData,
      );
    }
  });

  if (layerId) {
    const layerKey = `${chartId}-${layerId}`;
    const layerFilterData = dataMask[layerKey];
    if (layerFilterData?.extraFormData) {
      extraFormData = mergeExtraFormData(
        extraFormData,
        layerFilterData.extraFormData,
      );
    }
  }

  return extraFormData;
}
