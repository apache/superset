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
import { hasStatefulCharts } from '../dashboard/util/chartStateConverter';
import { getChartDataPayloads as getChartDataPayloadsUtil } from './utils';

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
  getChartDataPayloads: (params?: {
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

const getChartDataPayloads = async (params?: {
  chartId?: number;
}): Promise<Record<string, JsonObject>> => {
  const state = store?.getState();
  if (!state) return {};

  return getChartDataPayloadsUtil(state, params);
};

export const embeddedApi: EmbeddedSupersetApi = {
  getScrollSize,
  getDashboardPermalink,
  getActiveTabs,
  getDataMask,
  getChartStates,
  getChartDataPayloads,
};
