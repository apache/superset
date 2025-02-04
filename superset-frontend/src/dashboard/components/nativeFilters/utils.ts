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
