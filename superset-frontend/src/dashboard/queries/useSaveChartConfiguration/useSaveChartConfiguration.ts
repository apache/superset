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
import { useMutation } from '@tanstack/react-query';
import { t } from '@apache-superset/core/translation';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import {
  ChartConfiguration,
  GlobalChartCrossFilterConfig,
} from 'src/dashboard/types';
import { useDashboardInfoStore } from 'src/dashboard/stores';
import { queryClient } from 'src/queries/queryClient';
import {
  applyMetadataSaveResult,
  createUpdateDashboardApi,
} from '../updateDashboardApi';

export interface SaveChartConfigurationVariables {
  chartConfiguration?: ChartConfiguration;
  globalChartConfiguration?: GlobalChartCrossFilterConfig;
}

/**
 * Persists chart cross-filter configuration and syncs metadata into the store /
 * cache. Exported for the still-Redux saveDashboardRequest thunk.
 */
export async function persistChartConfiguration({
  chartConfiguration,
  globalChartConfiguration,
}: SaveChartConfigurationVariables) {
  const { id, metadata } = useDashboardInfoStore.getState().dashboardInfo;
  const response = await createUpdateDashboardApi(id)({
    json_metadata: JSON.stringify({
      ...metadata,
      chart_configuration: chartConfiguration ?? metadata.chart_configuration,
      global_chart_configuration:
        globalChartConfiguration ?? metadata.global_chart_configuration,
    }),
  });
  applyMetadataSaveResult(queryClient, id, response);
}

/** Persists the dashboard's chart cross-filter configuration. */
export function useSaveChartConfiguration() {
  const { addDangerToast } = useToasts();
  return useMutation({
    mutationFn: persistChartConfiguration,
    onError: () => {
      addDangerToast(t('Failed to save cross-filter scoping'));
    },
  });
}
