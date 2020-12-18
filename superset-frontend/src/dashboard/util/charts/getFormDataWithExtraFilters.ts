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
} from '@superset-ui/core';
import { ChartQueryPayload } from 'src/dashboard/types';
import { NativeFiltersState } from 'src/dashboard/components/nativeFilters/types';
import { getExtraFormData } from 'src/dashboard/components/nativeFilters/utils';
import getEffectiveExtraFilters from './getEffectiveExtraFilters';

// We cache formData objects so that our connected container components don't always trigger
// render cascades. we cannot leverage the reselect library because our cache size is >1
const cachedFiltersByChart = {};
const cachedFormdataByChart = {};

interface GetFormDataWithExtraFiltersArguments {
  chart: ChartQueryPayload;
  filters: DataRecordFilters;
  colorScheme?: string;
  colorNamespace?: string;
  sliceId: number;
  nativeFilters: NativeFiltersState;
}

// this function merge chart's formData with dashboard filters value,
// and generate a new formData which will be used in the new query.
// filters param only contains those applicable to this chart.
export default function getFormDataWithExtraFilters({
  chart,
  filters,
  colorScheme,
  colorNamespace,
  sliceId,
  nativeFilters,
}: GetFormDataWithExtraFiltersArguments) {
  // Propagate color mapping to chart
  const scale = CategoricalColorNamespace.getScale(colorScheme, colorNamespace);
  const labelColors = scale.getColorMap();

  // if dashboard metadata + filters have not changed, use cache if possible
  if (
    (cachedFiltersByChart[sliceId] || {}) === filters &&
    (colorScheme == null ||
      cachedFormdataByChart[sliceId].color_scheme === colorScheme) &&
    cachedFormdataByChart[sliceId].color_namespace === colorNamespace &&
    isEqual(cachedFormdataByChart[sliceId].label_colors, labelColors) &&
    !!cachedFormdataByChart[sliceId] &&
    nativeFilters === undefined
  ) {
    return cachedFormdataByChart[sliceId];
  }

  const formData = {
    ...chart.formData,
    ...(colorScheme && { color_scheme: colorScheme }),
    label_colors: labelColors,
    extra_filters: getEffectiveExtraFilters(filters),
    extra_form_data: getExtraFormData(nativeFilters),
  };
  cachedFiltersByChart[sliceId] = filters;
  cachedFormdataByChart[sliceId] = formData;

  return formData;
}
