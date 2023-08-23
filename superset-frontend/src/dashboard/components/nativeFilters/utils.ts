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
  isFeatureEnabled,
  FeatureFlag,
  Filter,
  getChartMetadataRegistry,
  QueryFormData,
} from '@superset-ui/core';
import { DashboardLayout } from 'src/dashboard/types';
import extractUrlParams from 'src/dashboard/util/extractUrlParams';
import { CHART_TYPE, TAB_TYPE } from '../../util/componentTypes';
import { DASHBOARD_GRID_ID, DASHBOARD_ROOT_ID } from '../../util/constants';
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
    !behaviors.includes(Behavior.NATIVE_FILTER) ||
    (isFeatureEnabled(FeatureFlag.DASHBOARD_FILTERS_EXPERIMENTAL) &&
      isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS) &&
      behaviors.includes(Behavior.INTERACTIVE_CHART))
  );
}

const isComponentATab = (
  dashboardLayout: DashboardLayout,
  componentId: string,
) => dashboardLayout?.[componentId]?.type === TAB_TYPE;

const findTabsWithChartsInScopeHelper = (
  dashboardLayout: DashboardLayout,
  chartsInScope: number[],
  componentId: string,
  tabIds: string[],
  tabsToHighlight: Set<string>,
  visited: Set<string>,
) => {
  if (visited.has(componentId)) {
    return;
  }
  visited.add(componentId);
  if (
    dashboardLayout?.[componentId]?.type === CHART_TYPE &&
    chartsInScope.includes(dashboardLayout[componentId]?.meta?.chartId)
  ) {
    tabIds.forEach(tabsToHighlight.add, tabsToHighlight);
  }
  if (
    dashboardLayout?.[componentId]?.children?.length === 0 ||
    (isComponentATab(dashboardLayout, componentId) &&
      tabsToHighlight.has(componentId))
  ) {
    return;
  }
  dashboardLayout[componentId]?.children.forEach(childId =>
    findTabsWithChartsInScopeHelper(
      dashboardLayout,
      chartsInScope,
      childId,
      isComponentATab(dashboardLayout, childId) ? [...tabIds, childId] : tabIds,
      tabsToHighlight,
      visited,
    ),
  );
};

export const findTabsWithChartsInScope = (
  dashboardLayout: DashboardLayout,
  chartsInScope: number[],
) => {
  const dashboardRoot = dashboardLayout[DASHBOARD_ROOT_ID];
  const rootChildId = dashboardRoot.children[0];
  const hasTopLevelTabs = rootChildId !== DASHBOARD_GRID_ID;
  const tabsInScope = new Set<string>();
  const visited = new Set<string>();
  if (hasTopLevelTabs) {
    dashboardLayout[rootChildId]?.children?.forEach(tabId =>
      findTabsWithChartsInScopeHelper(
        dashboardLayout,
        chartsInScope,
        tabId,
        [tabId],
        tabsInScope,
        visited,
      ),
    );
  } else {
    Object.values(dashboardLayout)
      .filter(element => element?.type === TAB_TYPE)
      .forEach(element =>
        findTabsWithChartsInScopeHelper(
          dashboardLayout,
          chartsInScope,
          element.id,
          [element.id],
          tabsInScope,
          visited,
        ),
      );
  }
  return tabsInScope;
};
