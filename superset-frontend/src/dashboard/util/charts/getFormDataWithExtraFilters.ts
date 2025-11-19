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
  ensureIsArray,
  JsonObject,
  PartialFilters,
  QueryFormExtraFilter,
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
import {
  isSingleColumnDimensionChart,
  limitColumnsForChartType,
  isChartWithoutGroupBy,
} from './chartTypeLimitations';
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
  chart: Pick<ChartQueryPayload, 'id' | 'form_data'>;
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

function extractColumnNames(columns: unknown[]): string[] {
  const columnNames: string[] = [];
  if (Array.isArray(columns)) {
    columns.forEach((col: unknown) => {
      if (typeof col === 'string') {
        columnNames.push(col);
      } else if (col && typeof col === 'object' && 'column_name' in col) {
        columnNames.push((col as { column_name: string }).column_name);
      }
    });
  }
  return columnNames;
}

function buildExistingColumnsSet(chart: ChartQueryPayload): Set<string> {
  const existingColumns = new Set<string>();
  const chartType = chart.form_data?.viz_type;

  const existingGroupBy = ensureIsArray(chart.form_data?.groupby);
  existingGroupBy.forEach((col: string) => existingColumns.add(col));

  const xAxisColumn = chart.form_data?.x_axis;
  if (xAxisColumn && chartType !== 'heatmap' && chartType !== 'heatmap_v2') {
    existingColumns.add(xAxisColumn);
  }

  const metrics = chart.form_data?.metrics || [];
  metrics.forEach((metric: any) => {
    if (typeof metric === 'string') {
      existingColumns.add(metric);
    } else if (metric && typeof metric === 'object' && 'column' in metric) {
      const metricColumn = metric.column;
      if (typeof metricColumn === 'string') {
        existingColumns.add(metricColumn);
      } else if (
        metricColumn &&
        typeof metricColumn === 'object' &&
        'column_name' in metricColumn
      ) {
        existingColumns.add(metricColumn.column_name);
      }
    }
  });

  const seriesColumn = chart.form_data?.series;
  if (seriesColumn) existingColumns.add(seriesColumn);

  const entityColumn = chart.form_data?.entity;
  if (entityColumn) existingColumns.add(entityColumn);

  const targetColumn = chart.form_data?.target;
  if (targetColumn) existingColumns.add(targetColumn);

  if (chartType === 'box_plot') {
    const boxPlotColumns = extractColumnNames(chart.form_data?.columns || []);
    boxPlotColumns.forEach(col => existingColumns.add(col));
  }

  if (chartType === 'pivot_table_v2') {
    const pivotColumns = extractColumnNames(
      chart.form_data?.groupbyColumns || [],
    );
    pivotColumns.forEach(col => existingColumns.add(col));
  }

  return existingColumns;
}

function extractCustomizationColumnNames(customization: any): string[] {
  if (typeof customization.column === 'string') {
    return [customization.column];
  }

  if (Array.isArray(customization.column)) {
    return customization.column.filter(
      (col: string) => typeof col === 'string' && col.trim() !== '',
    );
  }

  if (
    typeof customization.column === 'object' &&
    customization.column !== null
  ) {
    const columnObj = customization.column as any;
    const columnName =
      columnObj.column_name || columnObj.name || String(columnObj);
    if (columnName && columnName.trim() !== '') {
      return [columnName];
    }
  }

  return [];
}

function applyChartSpecificGroupBy(
  chartType: string,
  groupByColumns: string[],
  existingGroupBy: string[],
  xAxisColumn?: string,
): any {
  const groupByFormData: any = {};

  if (groupByColumns.length === 0) return groupByFormData;

  if (
    chartType?.startsWith('echarts_timeseries') ||
    chartType?.startsWith('echarts_area')
  ) {
    if (xAxisColumn) {
      const nonConflictingGroupByColumns = groupByColumns.filter(
        columnName => columnName !== xAxisColumn,
      );
      groupByFormData.groupby =
        nonConflictingGroupByColumns.length > 0
          ? nonConflictingGroupByColumns
          : existingGroupBy;
    } else {
      groupByFormData.groupby =
        groupByColumns.length > 0 ? groupByColumns : existingGroupBy;
    }
  } else if (chartType === 'word_cloud') {
    const { limitedColumns } = limitColumnsForChartType(
      chartType,
      groupByColumns,
    );
    groupByFormData.series = limitedColumns[0];
    groupByFormData.groupby = [];
  } else if (chartType === 'heatmap' || chartType === 'heatmap_v2') {
    groupByFormData.groupby =
      groupByColumns.length > 0
        ? [groupByColumns[0]]
        : existingGroupBy.filter(col => col !== xAxisColumn);
  } else if (chartType === 'waterfall') {
    const { limitedColumns } = limitColumnsForChartType(
      chartType,
      groupByColumns,
    );
    groupByFormData.groupby = [limitedColumns[0]];
  } else if (chartType === 'sunburst_v2') {
    groupByFormData.columns = groupByColumns;
    groupByFormData.groupby = [];
  } else if (chartType === 'graph_chart') {
    const { limitedColumns } = limitColumnsForChartType(
      chartType,
      groupByColumns,
    );
    groupByFormData.source = limitedColumns[0];
    if (limitedColumns.length > 1) {
      groupByFormData.target = limitedColumns[1];
    }
  } else if (chartType === 'sankey_v2') {
    const { limitedColumns } = limitColumnsForChartType(
      chartType,
      groupByColumns,
    );
    groupByFormData.source = limitedColumns[0];
    if (limitedColumns.length > 1) {
      groupByFormData.target = limitedColumns[1];
    }
  } else if (['chord'].includes(chartType)) {
    groupByFormData.groupby = [...existingGroupBy, ...groupByColumns];
  } else if (chartType === 'bubble_v2') {
    const { limitedColumns } = limitColumnsForChartType(
      chartType,
      groupByColumns,
    );
    groupByFormData.series = limitedColumns[0];
    if (limitedColumns.length > 1) {
      groupByFormData.entity = limitedColumns[1];
    }
    groupByFormData.groupby = [];
  } else if (chartType === 'pivot_table_v2') {
    groupByFormData.groupbyColumns = groupByColumns;
  } else if (chartType === 'treemap_v2') {
    groupByFormData.groupby = groupByColumns;
  } else {
    groupByFormData.groupby = groupByColumns;
  }

  return groupByFormData;
}

function processGroupByCustomizations(
  chartCustomizationItems: ChartCustomizationItem[],
  chart: ChartQueryPayload,
  groupByState: Record<string, { selectedValues: string[] }>,
): {
  groupby?: string[];
  order_by_cols?: string[];
  filters?: QueryFormExtraFilter[];
  x_axis?: string;
  series?: string;
  columns?: string[];
  entity?: string;
  source?: string;
  target?: string;
  groupbyColumns?: string[];
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
  if (isChartWithoutGroupBy(chartType)) {
    return {};
  }

  const existingColumns = buildExistingColumnsSet(chart);
  const existingGroupBy = ensureIsArray(chart.form_data?.groupby);
  const xAxisColumn = chart.form_data?.x_axis;

  const groupByColumns: string[] = [];
  const allFilters: QueryFormExtraFilter[] = [];
  let orderByConfig: string[] | undefined;
  let heatmapColumnAdded = false;

  matchingCustomizations.forEach(item => {
    const { customization } = item;
    if (!customization) return;

    const groupById = `chart_customization_${item.id}`;
    const selectedValues = groupByState[groupById]?.selectedValues || [];

    const columnNames = extractCustomizationColumnNames(customization);
    if (columnNames.length === 0) {
      return;
    }

    const nonConflictingColumns = columnNames.filter(
      columnName => !existingColumns.has(columnName),
    );

    if (nonConflictingColumns.length === 0) {
      return;
    }

    if (isSingleColumnDimensionChart(chartType)) {
      if (!heatmapColumnAdded && nonConflictingColumns.length > 0) {
        const firstColumn = nonConflictingColumns[0];
        if (!groupByColumns.includes(firstColumn)) {
          groupByColumns.push(firstColumn);
          heatmapColumnAdded = true;
        }
      }
      if (nonConflictingColumns.length > 1) {
        limitColumnsForChartType(chartType, nonConflictingColumns);
      }
    } else {
      nonConflictingColumns.forEach(columnName => {
        if (!groupByColumns.includes(columnName)) {
          groupByColumns.push(columnName);
        }
      });
    }

    columnNames.forEach(columnName => {
      if (selectedValues.length > 0) {
        allFilters.push({
          col: columnName,
          op: 'IN',
          val: selectedValues,
        });
      }
    });

    if (customization.sortFilter && customization.sortMetric) {
      orderByConfig = [
        JSON.stringify([
          customization.sortMetric,
          !customization.sortAscending,
        ]),
      ];
    }
  });

  const groupByFormData = applyChartSpecificGroupBy(
    chartType,
    groupByColumns,
    existingGroupBy,
    xAxisColumn,
  );

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
  Object.entries(dataMask).forEach(([key, mask]) => {
    if (key.startsWith('chart_customization_')) {
      const selectedValues = mask.filterState?.value;
      if (Array.isArray(selectedValues)) {
        groupByState[key] = { selectedValues };
      }
    }
  });

  const groupByFormData = processGroupByCustomizations(
    chartCustomizationItems || [],
    chart,
    groupByState,
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
