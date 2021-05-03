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
  Behavior,
  EXTRA_FORM_DATA_APPEND_KEYS,
  EXTRA_FORM_DATA_OVERRIDE_KEYS,
  AdhocFilter,
} from '@superset-ui/core';
import { Charts } from 'src/dashboard/types';
import { RefObject } from 'react';
import { DataMaskStateWithId } from 'src/dataMask/types';
import { Filter } from './types';

export const getFormData = ({
  datasetId,
  cascadingFilters = {},
  groupby,
  inputRef,
  defaultDataMask,
  controlValues,
  filterType,
  sortMetric,
  adhoc_filters,
  time_range,
}: Partial<Filter> & {
  datasetId?: number;
  inputRef?: RefObject<HTMLInputElement>;
  cascadingFilters?: object;
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
    extra_form_data: cascadingFilters,
    granularity_sqla: 'ds',
    metrics: ['count'],
    row_limit: 10000,
    showSearch: true,
    defaultValue: defaultDataMask?.filterState?.value,
    time_range,
    time_range_endpoints: ['inclusive', 'exclusive'],
    url_params: {},
    viz_type: filterType,
    inputRef,
  };
};

export function mergeExtraFormData(
  originalExtra: ExtraFormData = {},
  newExtra: ExtraFormData = {},
): ExtraFormData {
  const mergedExtra: ExtraFormData = {};
  EXTRA_FORM_DATA_APPEND_KEYS.forEach((key: string) => {
    const mergedValues = [
      ...(originalExtra[key] || []),
      ...(newExtra[key] || []),
    ];
    if (mergedValues.length) {
      mergedExtra[key] = mergedValues;
    }
  });
  EXTRA_FORM_DATA_OVERRIDE_KEYS.forEach((key: string) => {
    const originalValue = originalExtra[key];
    if (originalValue !== undefined) {
      mergedExtra[key] = originalValue;
    }
    const newValue = newExtra[key];
    if (newValue !== undefined) {
      mergedExtra[key] = newValue;
    }
  });
  return mergedExtra;
}

export function isCrossFilter(vizType: string) {
  // @ts-ignore need export from superset-ui `ItemWithValue`
  return getChartMetadataRegistry().items[vizType]?.value.behaviors?.includes(
    Behavior.INTERACTIVE_CHART,
  );
}

export function getExtraFormData(
  dataMask: DataMaskStateWithId,
  charts: Charts,
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
