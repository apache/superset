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
  ExtraFormData,
  QueryFormData,
  getChartMetadataRegistry,
  QueryObject,
  Behavior,
} from '@superset-ui/core';
import { Charts } from 'src/dashboard/types';
import { RefObject } from 'react';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { Filter } from './types';
import { NativeFiltersState } from '../../reducers/types';

export const getFormData = ({
  datasetId = 18,
  cascadingFilters = {},
  groupby,
  currentValue,
  inputRef,
  defaultValue,
  controlValues,
}: Partial<Filter> & {
  datasetId?: number;
  inputRef?: RefObject<HTMLInputElement>;
  cascadingFilters?: object;
  groupby: string;
}): Partial<QueryFormData> => ({
  adhoc_filters: [],
  datasource: `${datasetId}__table`,
  extra_filters: [],
  extra_form_data: cascadingFilters,
  granularity_sqla: 'ds',
  groupby: [groupby],
  metrics: ['count'],
  row_limit: 10000,
  showSearch: true,
  currentValue,
  defaultValue,
  time_range: 'No filter',
  time_range_endpoints: ['inclusive', 'exclusive'],
  url_params: {},
  viz_type: 'filter_select',
  inputRef,
  ...controlValues,
});

export function mergeExtraFormData(
  originalExtra: ExtraFormData,
  newExtra: ExtraFormData,
): ExtraFormData {
  const {
    override_form_data: originalOverride = {},
    append_form_data: originalAppend = {},
  } = originalExtra;
  const {
    override_form_data: newOverride = {},
    append_form_data: newAppend = {},
  } = newExtra;

  const appendKeys = new Set([
    ...Object.keys(originalAppend),
    ...Object.keys(newAppend),
  ]);
  const appendFormData: Partial<QueryObject> = {};
  appendKeys.forEach(key => {
    appendFormData[key] = [
      // @ts-ignore
      ...(originalAppend?.[key] || []),
      // @ts-ignore
      ...(newAppend?.[key] || []),
    ];
  });

  return {
    override_form_data: {
      ...originalOverride,
      ...newOverride,
    },
    append_form_data: appendFormData,
  };
}

export function isCrossFilter(vizType: string) {
  // @ts-ignore need export from superset-ui `ItemWithValue`
  return getChartMetadataRegistry().items[vizType]?.value.behaviors?.includes(
    Behavior.CROSS_FILTER,
  );
}

export function getExtraFormData(
  nativeFilters: NativeFiltersState,
  charts: Charts,
): ExtraFormData {
  let extraFormData: ExtraFormData = {};
  Object.keys(nativeFilters.filters).forEach(key => {
    const filterState = nativeFilters.filtersState[key] || {};
    const { extraFormData: newExtra = {} } = filterState;
    extraFormData = mergeExtraFormData(extraFormData, newExtra);
  });
  if (isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)) {
    Object.entries(charts).forEach(([key, chart]) => {
      if (isCrossFilter(chart?.formData?.viz_type)) {
        const filterState = nativeFilters.filtersState[key] || {};
        const { extraFormData: newExtra = {} } = filterState;
        extraFormData = mergeExtraFormData(extraFormData, newExtra);
      }
    });
  }
  return extraFormData;
}
