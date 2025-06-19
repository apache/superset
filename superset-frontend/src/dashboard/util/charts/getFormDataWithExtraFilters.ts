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
  ExtraFormData,
} from '@superset-ui/core';
import {
  ChartConfiguration,
  ChartQueryPayload,
  RootState,
} from 'src/dashboard/types';
import {
  getExtraFormData,
  mergeExtraFormData,
} from 'src/dashboard/components/nativeFilters/utils';
import { isEqual } from 'lodash';
import { areObjectsEqual } from 'src/reduxUtils';
import { selectChartCustomizationItems } from '../../components/nativeFilters/ChartCustomization/selectors';
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
}

export type CachedFormDataWithExtraControls = CachedFormData & {
  [key: string]: any;
};

// We cache formData objects so that our connected container components don't always trigger
// render cascades. we cannot leverage the reselect library because our cache size is >1
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
}

// this function merge chart's formData with dashboard filters value,
// and generate a new formData which will be used in the new query.
// filters param only contains those applicable to this chart.
export default function getFormDataWithExtraFilters({
  chart,
  filters,
  nativeFilters,
  chartConfiguration,
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
}: GetFormDataWithExtraFiltersArguments) {
  // if dashboard metadata + filters have not changed, use cache if possible
  const cachedFormData = cachedFormdataByChart[sliceId];
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
    areObjectsEqual(cachedFormData?.dataMask, dataMask, {
      ignoreUndefined: true,
    }) &&
    areObjectsEqual(cachedFormData?.extraControls, extraControls, {
      ignoreUndefined: true,
    }) &&
    areObjectsEqual(cachedFormData?.chart_customization, chartCustomization, {
      ignoreUndefined: true,
    })
  ) {
    return cachedFormData;
  }

  let extraData: { extra_form_data?: JsonObject } = {};
  const activeFilters = getAllActiveFilters({
    chartConfiguration,
    dataMask,
    nativeFilters,
    allSliceIds,
  });
  const filterIdsAppliedOnChart = Object.entries(activeFilters)
    .filter(([, { scope }]) => scope.includes(chart.id))
    .map(([filterId]) => filterId);

  let extraFormData: ExtraFormData = {};
  if (filterIdsAppliedOnChart.length) {
    extraFormData = getExtraFormData(dataMask, filterIdsAppliedOnChart);
  }

  try {
    const state = nativeFilters as unknown as RootState;
    const chartCustomizationItems = selectChartCustomizationItems(state);

    if (chartCustomizationItems && chartCustomizationItems.length > 0) {
      const chartDataset = chart.form_data?.datasource;
      if (chartDataset) {
        const chartDatasetParts = String(chartDataset).split('__');
        const chartDatasetId = chartDatasetParts[0];

        const matchingCustomizations = chartCustomizationItems.filter(item => {
          if (item.removed) return false;

          const targetDataset = item.customization?.dataset;
          if (!targetDataset) return false;

          const targetDatasetId = String(targetDataset);

          return chartDatasetId === targetDatasetId;
        });

        matchingCustomizations.forEach(item => {
          const { customization } = item;

          if (customization?.column) {
            const customExtraFormData: ExtraFormData = {
              groupby: [customization.column],
            } as unknown as ExtraFormData;
            if (customization.sortFilter && customization.sortMetric) {
              (customExtraFormData as any).order_by_cols = [
                JSON.stringify([
                  customization.sortMetric,
                  !customization.sortAscending,
                ]),
              ];
            }

            extraFormData = mergeExtraFormData(
              extraFormData,
              customExtraFormData,
            );
          }
        });
      }
    }
  } catch (error) {
    console.error('Error applying chart customization:', error);
  }

  extraData = {
    extra_form_data: extraFormData,
  };

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
    ...(chartCustomization && { chart_customization: chartCustomization }),
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
