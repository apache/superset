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
  DataMask,
  DataMaskStateWithId,
  DataRecordFilters,
  DataRecordValue,
  JsonObject,
  PartialFilters,
} from '@superset-ui/core';
import {
  ChartConfiguration,
  ChartQueryPayload,
  ActiveFilters,
} from 'src/dashboard/types';
import { ChartCustomizationItem } from 'src/dashboard/components/nativeFilters/ChartCustomization/types';
import { getExtraFormData } from 'src/dashboard/components/nativeFilters/utils';
import { isEqual } from 'lodash';
import { areObjectsEqual } from 'src/reduxUtils';
import getEffectiveExtraFilters from './getEffectiveExtraFilters';
import { getAllActiveFilters } from '../activeAllDashboardFilters';

interface CachedFormData {
  extra_form_data?: JsonObject;
  extra_filters: {
    col: string;
    op: string;
    val: DataRecordValue[];
  }[];
  own_color_scheme?: string;
  color_scheme?: string;
  color_namespace?: string;
  chart_id: number;
  label_colors?: Record<string, string>;
  shared_label_colors?: string[];
  map_label_colors?: Record<string, string>;
  chart_customization?: JsonObject;
  layer_filter_scope?: {
    [filterId: string]: number[];
  };
  filter_data_mapping?: {
    [filterId: string]: any[];
  };
}

export type CachedFormDataWithExtraControls = CachedFormData & {
  [key: string]: any;
};

const cachedFiltersByChart: Record<number, DataRecordFilters> = {};
const cachedFormdataByChart: Record<
  number,
  CachedFormData & {
    dataMask: DataMask;
    extraControls: Record<string, string | boolean | null>;
  }
> = {};

export interface GetFormDataWithExtraFiltersArguments {
  chartConfiguration: ChartConfiguration;
  chartCustomizationItems?: ChartCustomizationItem[];
  chart: ChartQueryPayload;
  filters: DataRecordFilters;
  colorScheme?: string;
  ownColorScheme?: string;
  colorNamespace?: string;
  sliceId: number;
  dataMask: DataMaskStateWithId;
  nativeFilters: PartialFilters;
  extraControls: Record<string, string | boolean | null>;
  labelsColor?: Record<string, string>;
  labelsColorMap?: Record<string, string>;
  sharedLabelsColors?: string[];
  allSliceIds: number[];
  chartCustomization?: JsonObject;
  activeFilters?: ActiveFilters;
}

const createFilterDataMapping = (
  dataMask: DataMaskStateWithId,
  filterIdsAppliedOnChart: string[],
): { [filterId: string]: any[] } => {
  const filterDataMapping: { [filterId: string]: any[] } = {};

  filterIdsAppliedOnChart.forEach(filterId => {
    const filterFormData = getExtraFormData(dataMask, [filterId]);
    if (filterFormData.filters && filterFormData.filters.length > 0) {
      filterDataMapping[filterId] = filterFormData.filters;
    }
  });

  return filterDataMapping;
};

function processGroupByCustomizations(
  chartCustomizationItems: ChartCustomizationItem[],
  chart: ChartQueryPayload,
  groupByState: Record<string, { selectedValues: string[] }>,
  chartCustomizationDataMask: Record<string, DataMask>,
): {
  groupby?: string[];
  order_by_cols?: string[];
  filters?: any[];
} {
  if (!chartCustomizationItems || chartCustomizationItems.length === 0) {
    return {};
  }

  const chartDataset = chart.form_data?.datasource;
  if (!chartDataset) {
    return {};
  }

  const chartDatasetParts = String(chartDataset).split('__');
  const chartDatasetId = chartDatasetParts[0];

  const matchingCustomizations = chartCustomizationItems.filter(item => {
    if (item.removed) return false;

    const targetDataset = item.customization?.dataset;
    if (!targetDataset) return false;

    const targetDatasetId = String(targetDataset);
    const datasetMatches = chartDatasetId === targetDatasetId;

    const chartMatches = !item.chartId || item.chartId === chart.id;

    return datasetMatches && chartMatches;
  });

  const chartType = chart.form_data?.viz_type;
  if (chartType === 'big_number' || chartType === 'big_number_total') {
    return {};
  }

  const groupByFormData: {
    groupby?: string[];
    order_by_cols?: string[];
    filters?: any[];
  } = {};

  const groupByColumns = new Set<string>();
  const allFilters: any[] = [];
  let orderByConfig: string[] | undefined;

  const existingGroupBy = chart.form_data?.groupby || [];
  const xAxisColumn = chart.form_data?.x_axis;
  const conflictingColumns = new Set([
    ...existingGroupBy,
    ...(xAxisColumn ? [xAxisColumn] : []),
  ]);

  if (
    chartType?.startsWith('echarts_timeseries') ||
    chartType?.startsWith('echarts_area')
  ) {
    if (xAxisColumn) {
      conflictingColumns.add(xAxisColumn);
    }
  } else if (chartType === 'heatmap_v2') {
    if (xAxisColumn) {
      conflictingColumns.add(xAxisColumn);
    }
    if (chart.form_data?.groupby) {
      const groupbyColumn = Array.isArray(chart.form_data.groupby)
        ? chart.form_data.groupby[0]
        : chart.form_data.groupby;
      if (groupbyColumn) {
        conflictingColumns.add(groupbyColumn);
      }
    }
  } else if (chartType === 'pivot_table_v2') {
    const groupbyColumns = chart.form_data?.groupbyColumns || [];
    const groupbyRows = chart.form_data?.groupbyRows || [];
    [...groupbyColumns, ...groupbyRows].forEach(col => {
      if (col) conflictingColumns.add(col);
    });
  }

  matchingCustomizations.forEach(item => {
    const { customization } = item;
    const groupById = `chart_customization_${item.id}`;

    if (!chartCustomizationDataMask[groupById]) {
      return;
    }

    const selectedValues = groupByState[groupById]?.selectedValues || [];

    if (customization?.column) {
      let columnName: string;

      const dataMaskEntry = chartCustomizationDataMask[groupById];
      const pendingColumn = dataMaskEntry?.ownState?.column;

      if (pendingColumn) {
        columnName = pendingColumn;
      } else if (typeof customization.column === 'string') {
        columnName = customization.column;
      } else if (
        typeof customization.column === 'object' &&
        customization.column !== null
      ) {
        const columnObj = customization.column as any;
        columnName =
          columnObj.column_name || columnObj.name || String(columnObj);
      } else {
        console.warn('Invalid column format:', customization.column);
        return;
      }

      if (!columnName || columnName.trim() === '') {
        console.warn('Empty column name in customization:', item.id);
        return;
      }

      if (conflictingColumns.has(columnName)) {
        console.warn(
          `Column "${columnName}" conflicts with existing chart columns. Skipping customization.`,
        );
        return;
      }

      groupByColumns.add(columnName);

      if (selectedValues.length > 0) {
        allFilters.push({
          col: columnName,
          op: 'IN',
          val: selectedValues,
        });
      }

      if (customization.sortFilter && customization.sortMetric) {
        orderByConfig = [
          JSON.stringify([
            customization.sortMetric,
            !customization.sortAscending,
          ]),
        ];
      }
    }
  });

  if (groupByColumns.size > 0) {
    groupByFormData.groupby = Array.from(groupByColumns);
  }

  if (allFilters.length > 0) {
    groupByFormData.filters = allFilters;
  }

  if (orderByConfig) {
    groupByFormData.order_by_cols = orderByConfig;
  }

  return groupByFormData;
}

// this function merge chart's formData with dashboard filters value,
// and generate a new formData which will be used in the new query.
// filters param only contains those applicable to this chart.
export default function getFormDataWithExtraFilters({
  chart,
  filters,
  nativeFilters,
  chartConfiguration,
  chartCustomizationItems,
  colorScheme,
  ownColorScheme,
  colorNamespace,
  sliceId,
  dataMask,
  extraControls,
  labelsColor,
  labelsColorMap,
  sharedLabelsColors,
  allSliceIds,
  chartCustomization,
  activeFilters: passedActiveFilters,
}: GetFormDataWithExtraFiltersArguments) {
  const cachedFormData = cachedFormdataByChart[sliceId];
  const dataMaskEqual = areObjectsEqual(cachedFormData?.dataMask, dataMask, {
    ignoreUndefined: true,
  });
  if (
    cachedFiltersByChart[sliceId] === filters &&
    areObjectsEqual(cachedFormData?.own_color_scheme, ownColorScheme) &&
    areObjectsEqual(cachedFormData?.color_scheme, colorScheme) &&
    areObjectsEqual(cachedFormData?.color_namespace, colorNamespace, {
      ignoreUndefined: true,
    }) &&
    areObjectsEqual(cachedFormData?.label_colors, labelsColor, {
      ignoreUndefined: true,
    }) &&
    areObjectsEqual(cachedFormData?.map_label_colors, labelsColorMap, {
      ignoreUndefined: true,
    }) &&
    isEqual(cachedFormData?.shared_label_colors, sharedLabelsColors) &&
    !!cachedFormData &&
    dataMaskEqual &&
    areObjectsEqual(cachedFormData?.extraControls, extraControls, {
      ignoreUndefined: true,
    }) &&
    areObjectsEqual(cachedFormData?.chart_customization, chartCustomization, {
      ignoreUndefined: true,
    })
  ) {
    return cachedFormData;
  }

  const activeFilters: ActiveFilters =
    passedActiveFilters ||
    getAllActiveFilters({
      chartConfiguration,
      nativeFilters,
      dataMask,
      allSliceIds,
    });

  let extraData: JsonObject = {};
  const filterIdsAppliedOnChart = Object.entries(activeFilters)
    .filter(([, activeFilter]) => activeFilter.scope.includes(chart.id))
    .map(([filterId]) => filterId);

  if (filterIdsAppliedOnChart.length) {
    const aggregatedFormData = getExtraFormData(
      dataMask,
      filterIdsAppliedOnChart,
    );
    extraData = {
      extra_form_data: aggregatedFormData,
    };

    const isDeckMultiChart = chart.form_data?.viz_type === 'deck_multi';
    const hasLayerScopeInActiveFilters =
      passedActiveFilters &&
      Object.values(passedActiveFilters).some(filter => filter.layerScope);

    if (isDeckMultiChart || hasLayerScopeInActiveFilters) {
      const filterDataMapping = createFilterDataMapping(
        dataMask,
        filterIdsAppliedOnChart,
      );
      extraData.filter_data_mapping = filterDataMapping;
    }
  }

  let layerFilterScope: { [filterId: string]: number[] } | undefined;

  const isDeckMultiChart = chart.form_data?.viz_type === 'deck_multi';
  const hasLayerScopeInActiveFilters =
    passedActiveFilters &&
    Object.values(passedActiveFilters).some(filter => filter.layerScope);

  if (isDeckMultiChart || hasLayerScopeInActiveFilters) {
    layerFilterScope = {};

    Object.entries(activeFilters).forEach(([filterId, activeFilter]) => {
      if (activeFilter.layerScope?.[chart.id]) {
        layerFilterScope![filterId] = activeFilter.layerScope[chart.id];
      }
    });

    if (Object.keys(layerFilterScope).length === 0) {
      layerFilterScope = undefined;
    }
  }

  const groupByState: Record<string, { selectedValues: string[] }> = {};
  const chartCustomizationDataMask: Record<string, DataMask> = {};
  Object.entries(dataMask).forEach(([key, mask]) => {
    if (key.startsWith('chart_customization_')) {
      const selectedValues = mask.filterState?.value;
      if (Array.isArray(selectedValues)) {
        groupByState[key] = { selectedValues };
      }
      chartCustomizationDataMask[key] = mask;
    }
  });

  const groupByFormData = processGroupByCustomizations(
    chartCustomizationItems || [],
    chart,
    groupByState,
    chartCustomizationDataMask,
  );

  const formData: CachedFormDataWithExtraControls = {
    ...chart.form_data,
    chart_id: chart.id,
    label_colors: labelsColor,
    shared_label_colors: sharedLabelsColors,
    map_label_colors: labelsColorMap,
    ...(colorScheme && { color_scheme: colorScheme }),
    ...(ownColorScheme && {
      own_color_scheme: ownColorScheme,
    }),
    extra_filters: getEffectiveExtraFilters(filters),
    ...extraData,
    ...extraControls,
    ...groupByFormData,
    ...(chartCustomization && { chart_customization: chartCustomization }),
    ...(layerFilterScope && { layer_filter_scope: layerFilterScope }),
  };

  cachedFiltersByChart[sliceId] = filters;
  cachedFormdataByChart[sliceId] = {
    ...formData,
    dataMask,
    extraControls,
    ...(chartCustomization && { chart_customization: chartCustomization }),
  };

  return formData;
}
