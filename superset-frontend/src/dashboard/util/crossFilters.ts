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
import { getChartIdsInFilterScope } from './getChartIdsInFilterScope';
import {
  ChartsState,
  DashboardInfo,
  DashboardLayout,
  GLOBAL_SCOPE_POINTER,
  isCrossFilterScopeGlobal,
} from '../types';
import { DEFAULT_CROSS_FILTER_SCOPING } from '../constants';

export const isCrossFiltersEnabled = (
  metadataCrossFiltersEnabled: boolean | undefined,
): boolean =>
  isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS) &&
  (metadataCrossFiltersEnabled === undefined || metadataCrossFiltersEnabled);

export const getCrossFiltersConfiguration = (
  dashboardLayout: DashboardLayout,
  metadata: Pick<
    DashboardInfo['metadata'],
    'chart_configuration' | 'global_chart_configuration'
  >,
  charts: ChartsState,
) => {
  if (!isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)) {
    return undefined;
  }

  const globalChartConfiguration = metadata.global_chart_configuration?.scope
    ? {
        scope: metadata.global_chart_configuration.scope,
        chartsInScope: getChartIdsInFilterScope(
          metadata.global_chart_configuration.scope,
          Object.values(charts).map(chart => chart.id),
          dashboardLayout,
        ),
      }
    : {
        scope: DEFAULT_CROSS_FILTER_SCOPING,
        chartsInScope: Object.values(charts).map(chart => chart.id),
      };

  // If user just added cross filter to dashboard it's not saving its scope on server,
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
      if (metadata.chart_configuration?.[chartId]) {
        // We need to clone to avoid mutating Redux state
        chartConfiguration[chartId] = cloneDeep(
          metadata.chart_configuration[chartId],
        );
      }
      if (!chartConfiguration[chartId]) {
        chartConfiguration[chartId] = {
          id: chartId,
          crossFilters: {
            scope: GLOBAL_SCOPE_POINTER,
          },
        };
      }
      chartConfiguration[chartId].crossFilters.chartsInScope =
        isCrossFilterScopeGlobal(chartConfiguration[chartId].crossFilters.scope)
          ? globalChartConfiguration.chartsInScope.filter(
              id => id !== Number(chartId),
            )
          : getChartIdsInFilterScope(
              chartConfiguration[chartId].crossFilters.scope,
              Object.values(charts).map(chart => chart.id),
              dashboardLayout,
            );
    }
  });

  return { chartConfiguration, globalChartConfiguration };
};
