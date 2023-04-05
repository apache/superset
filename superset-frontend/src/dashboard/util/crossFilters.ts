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
import { cloneDeep } from 'lodash';
import {
  Behavior,
  FeatureFlag,
  getChartMetadataRegistry,
  isDefined,
  isFeatureEnabled,
} from '@superset-ui/core';
import { DASHBOARD_ROOT_ID } from './constants';
import { getChartIdsInFilterScope } from './getChartIdsInFilterScope';
import { ChartsState, DashboardInfo, DashboardLayout } from '../types';

export const isCrossFiltersEnabled = (
  metadataCrossFiltersEnabled: boolean | undefined,
): boolean =>
  isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS) &&
  (metadataCrossFiltersEnabled === undefined || metadataCrossFiltersEnabled);

export const getCrossFiltersConfiguration = (
  dashboardLayout: DashboardLayout,
  initialConfig: DashboardInfo['metadata']['chart_configuration'] = {},
  charts: ChartsState,
) => {
  if (!isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)) {
    return undefined;
  }
  // If user just added cross filter to dashboard it's not saving it scope on server,
  // so we tweak it until user will update scope and will save it in server
  const chartConfiguration = {};
  Object.values(dashboardLayout).forEach(layoutItem => {
    const chartId = layoutItem.meta?.chartId;

    if (!isDefined(chartId)) {
      return;
    }

    const behaviors =
      (
        getChartMetadataRegistry().get(charts[chartId]?.form_data?.viz_type) ??
        {}
      )?.behaviors ?? [];

    if (behaviors.includes(Behavior.INTERACTIVE_CHART)) {
      if (initialConfig[chartId]) {
        // We need to clone to avoid mutating Redux state
        chartConfiguration[chartId] = cloneDeep(initialConfig[chartId]);
      }
      if (!chartConfiguration[chartId]) {
        chartConfiguration[chartId] = {
          id: chartId,
          crossFilters: {
            scope: {
              rootPath: [DASHBOARD_ROOT_ID],
              excluded: [chartId], // By default it doesn't affects itself
            },
          },
        };
      }
      chartConfiguration[chartId].crossFilters.chartsInScope =
        getChartIdsInFilterScope(
          chartConfiguration[chartId].crossFilters.scope,
          charts,
          dashboardLayout,
        );
    }
  });
  return chartConfiguration;
};
