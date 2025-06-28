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
import { getExtraFormData } from 'src/dashboard/components/nativeFilters/utils';
import { areObjectsEqual } from 'src/reduxUtils';
import { isEqual } from 'lodash';
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
  activeFilters: passedActiveFilters,
}: GetFormDataWithExtraFiltersArguments) {
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
    ...(layerFilterScope && { layer_filter_scope: layerFilterScope }),
  };

  cachedFiltersByChart[sliceId] = filters;
  cachedFormdataByChart[sliceId] = { ...formData, dataMask, extraControls };

  return formData;
}
