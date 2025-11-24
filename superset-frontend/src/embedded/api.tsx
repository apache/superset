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
import { DataMaskStateWithId, JsonObject } from '@superset-ui/core';
import getBootstrapData from 'src/utils/getBootstrapData';
import { store } from '../views/store';
import { getDashboardPermalink as getDashboardPermalinkUtil } from '../utils/urlUtils';
import { DashboardChartStates } from '../dashboard/types/chartState';
import {
  hasStatefulCharts,
  hasChartStateConverter,
  convertChartStateToOwnState,
} from '../dashboard/util/chartStateConverter';
import getFormDataWithExtraFilters from '../dashboard/util/charts/getFormDataWithExtraFilters';
import { getAppliedFilterValues } from '../dashboard/util/activeDashboardFilters';
import { buildV1ChartDataPayload } from '../explore/exploreUtils';

const bootstrapData = getBootstrapData();

type Size = {
  width: number;
  height: number;
};

type EmbeddedSupersetApi = {
  getScrollSize: () => Size;
  getDashboardPermalink: ({ anchor }: { anchor: string }) => Promise<string>;
  getActiveTabs: () => string[];
  getDataMask: () => DataMaskStateWithId;
  getChartStates: () => DashboardChartStates;
  getChartDataPayloads: ({
    chartId,
  }: {
    chartId?: number;
  }) => Promise<Record<string, JsonObject>>;
};

const getScrollSize = (): Size => ({
  width: document.body.scrollWidth,
  height: document.body.scrollHeight,
});

const getDashboardPermalink = async ({
  anchor,
}: {
  anchor: string;
}): Promise<string> => {
  const state = store?.getState();
  const { dashboardId, dataMask, activeTabs, chartStates, sliceEntities } = {
    dashboardId:
      state?.dashboardInfo?.id || bootstrapData?.embedded!.dashboard_id,
    dataMask: state?.dataMask,
    activeTabs: state.dashboardState?.activeTabs,
    chartStates: state.dashboardState?.chartStates,
    sliceEntities: state?.sliceEntities?.slices,
  };

  const includeChartState =
    hasStatefulCharts(sliceEntities) &&
    chartStates &&
    Object.keys(chartStates).length > 0;

  return getDashboardPermalinkUtil({
    dashboardId,
    dataMask,
    activeTabs,
    anchor,
    chartStates: includeChartState ? chartStates : undefined,
    includeChartState,
  });
};

const getActiveTabs = () => store?.getState()?.dashboardState?.activeTabs || [];

const getDataMask = () => store?.getState()?.dataMask || {};

const getChartStates = () =>
  store?.getState()?.dashboardState?.chartStates || {};

/**
 * Get query context payloads for stateful charts (e.g., AG Grid tables).
 * These payloads include dashboard filters and chart state (sorting, column order, etc.)
 * and can be POSTed directly to /api/v1/chart/data for CSV export.
 *
 * @param chartId - Optional chart ID to get payload for a specific chart only
 * @returns Record of chart IDs to their query context payloads
 */
const getChartDataPayloads = async ({
  chartId,
}: {
  chartId?: number;
}): Promise<Record<string, JsonObject>> => {
  const state = store?.getState();
  if (!state) return {};

  const charts = state.charts || {};
  const sliceEntities = state.sliceEntities?.slices || {};
  const dataMask = state.dataMask || {};
  const chartStates = state.dashboardState?.chartStates || {};
  const chartConfiguration =
    state.dashboardInfo?.metadata?.chart_configuration || {};
  const nativeFilters = state.nativeFilters?.filters || {};
  const allSliceIds = state.dashboardState?.sliceIds || [];
  const colorScheme = state.dashboardState?.colorScheme;
  const colorNamespace = state.dashboardState?.colorNamespace;

  const payloads: Record<string, JsonObject> = {};

  // Build payloads for each eligible chart
  const chartEntries = Object.entries(charts).filter(([id]) => {
    const numericId = Number(id);
    const slice = sliceEntities[id];

    // Filter: only stateful charts (e.g., AG Grid)
    if (!slice || !hasChartStateConverter(slice.viz_type)) {
      return false;
    }

    // Filter: specific chartId if provided
    if (chartId !== undefined && numericId !== chartId) {
      return false;
    }

    return true;
  });

  // Process charts sequentially to avoid race conditions
  for (const [id, chart] of chartEntries) {
    const numericId = Number(id);
    const slice = sliceEntities[id];

    // Build enriched form_data with dashboard filters applied
    const formData = getFormDataWithExtraFilters({
      chart: { id: numericId, form_data: (chart as JsonObject).form_data },
      chartConfiguration,
      filters: getAppliedFilterValues(numericId),
      colorScheme,
      colorNamespace,
      sliceId: numericId,
      nativeFilters,
      allSliceIds,
      dataMask,
      extraControls: {},
    });

    const chartState = chartStates[id]?.state;
    const baseOwnState = dataMask[id]?.ownState || {};
    const convertedState = chartState
      ? convertChartStateToOwnState(slice.viz_type, chartState)
      : {};

    const ownState = {
      ...baseOwnState,
      ...convertedState,
    };

    const payload = await buildV1ChartDataPayload({
      formData,
      resultFormat: 'json',
      resultType: 'results',
      ownState,
      setDataMask: null,
      force: false,
    });

    payloads[id] = payload;
  }

  return payloads;
};

export const embeddedApi: EmbeddedSupersetApi = {
  getScrollSize,
  getDashboardPermalink,
  getActiveTabs,
  getDataMask,
  getChartStates,
  getChartDataPayloads,
};
