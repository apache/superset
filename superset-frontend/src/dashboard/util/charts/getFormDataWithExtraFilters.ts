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
import { isEqual } from 'lodash';
import {
  CategoricalColorNamespace,
  DataRecordFilters,
  JsonObject,
} from '@superset-ui/core';
import { ChartQueryPayload, Charts, LayoutItem } from 'src/dashboard/types';
import { getExtraFormData } from 'src/dashboard/components/nativeFilters/utils';
import { DataMaskStateWithId } from 'src/dataMask/types';
import { areObjectsEqual } from 'src/reduxUtils';
import getEffectiveExtraFilters from './getEffectiveExtraFilters';
import { ChartConfiguration, NativeFiltersState } from '../../reducers/types';
import { getAllActiveFilters } from '../activeAllDashboardFilters';

// We cache formData objects so that our connected container components don't always trigger
// render cascades. we cannot leverage the reselect library because our cache size is >1
const cachedFiltersByChart = {};
const cachedFormdataByChart = {};

export interface GetFormDataWithExtraFiltersArguments {
  chartConfiguration: ChartConfiguration;
  chart: ChartQueryPayload;
  charts: Charts;
  filters: DataRecordFilters;
  layout: { [key: string]: LayoutItem };
  colorScheme?: string;
  colorNamespace?: string;
  sliceId: number;
  dataMask: DataMaskStateWithId;
  nativeFilters: NativeFiltersState;
}

// this function merge chart's formData with dashboard filters value,
// and generate a new formData which will be used in the new query.
// filters param only contains those applicable to this chart.
export default function getFormDataWithExtraFilters({
  chart,
  charts,
  filters,
  nativeFilters,
  chartConfiguration,
  colorScheme,
  colorNamespace,
  sliceId,
  layout,
  dataMask,
}: GetFormDataWithExtraFiltersArguments) {
  // Propagate color mapping to chart
  const scale = CategoricalColorNamespace.getScale(colorScheme, colorNamespace);
  const labelColors = scale.getColorMap();

  // if dashboard metadata + filters have not changed, use cache if possible
  const cachedFormData = cachedFormdataByChart[sliceId];
  if (
    cachedFiltersByChart[sliceId] === filters &&
    cachedFormData?.color_scheme === colorScheme &&
    cachedFormData?.color_namespace === colorNamespace &&
    isEqual(cachedFormData?.label_colors, labelColors) &&
    !!cachedFormData &&
    areObjectsEqual(cachedFormData?.dataMask, dataMask, {
      ignoreUndefined: true,
    })
  ) {
    return cachedFormData;
  }

  let extraData: { extra_form_data?: JsonObject } = {};
  const activeFilters = getAllActiveFilters({
    chartConfiguration,
    dataMask,
    layout,
    nativeFilters: nativeFilters.filters,
  });
  const filterIdsAppliedOnChart = Object.entries(activeFilters)
    .filter(([, { scope }]) => scope.includes(chart.id))
    .map(([filterId]) => filterId);
  if (filterIdsAppliedOnChart.length) {
    extraData = {
      extra_form_data: getExtraFormData(
        dataMask,
        charts,
        filterIdsAppliedOnChart,
      ),
    };
  }

  const formData = {
    ...chart.formData,
    ...(colorScheme && { color_scheme: colorScheme }),
    label_colors: labelColors,
    extra_filters: getEffectiveExtraFilters(filters),
    ...extraData,
  };
  cachedFiltersByChart[sliceId] = filters;
  cachedFormdataByChart[sliceId] = formData;

  return formData;
}
