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
import { logging } from '@apache-superset/core/utils';
import getBootstrapData from 'src/utils/getBootstrapData';
import { batch } from 'react-redux';
import { store } from '../views/store';
import { getDashboardPermalink as getDashboardPermalinkUtil } from '../utils/urlUtils';
import { DashboardChartStates } from '../dashboard/types/chartState';
import { hasStatefulCharts } from '../dashboard/util/chartStateConverter';
import { getChartDataPayloads as getChartDataPayloadsUtil } from './utils';
import { updateDataMask } from '../dataMask/actions';

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
  setDataMask: ({ dataMask }: { dataMask: DataMaskStateWithId }) => void;
};

// Hosts size the iframe from this value, so it has to describe the content, not
// the frame. The app fills its frame by design, so measuring it directly just
// reads back the height the host already set, and a host that applies the
// result with any headroom of its own grows the iframe on every poll. Drop the
// fill-the-frame constraint, read, restore, all in one task so nothing repaints
// in between. Inline styles are used deliberately: a stylesheet rule has to win
// a specificity contest against whatever the theme sets, and losing it silently
// turns this back into a measurement of the frame.
//
// Before the dashboard lays out there is nothing to measure and the document is
// a few pixels tall. Report the viewport instead: a host applying that near
// zero height would collapse the frame, and charts only render once they are in
// view, so the embed could never recover.
const getScrollSize = (): Size => {
  const root = document.documentElement;
  const { body } = document;
  const app = document.getElementById('app');
  const content = document.querySelector(
    '[data-test="dashboard-content-wrapper"]',
  );
  if (!content || content.getBoundingClientRect().height === 0) {
    return { width: body.scrollWidth, height: root.clientHeight };
  }

  // The vertical filter bar is capped to the frame so its action buttons stay
  // reachable. That cap is viewport-derived too, so it has to come off for the
  // measurement or a tall filter list reports as frame-high.
  const bar = document.querySelector<HTMLElement>('.filter-bar-bounded');
  const previous = [
    root.style.height,
    body.style.height,
    app?.style.height,
    bar?.style.maxHeight,
  ];
  root.style.height = 'auto';
  body.style.height = 'auto';
  if (app) app.style.height = 'auto';
  if (bar) bar.style.maxHeight = 'none';
  try {
    // Reading these forces layout, so they reflect the lifted constraints.
    return { width: body.scrollWidth, height: body.scrollHeight };
  } finally {
    [root.style.height, body.style.height] = [previous[0]!, previous[1]!];
    if (app) app.style.height = previous[2]!;
    if (bar) bar.style.maxHeight = previous[3]!;
  }
};

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

  const { url } = await getDashboardPermalinkUtil({
    dashboardId,
    dataMask,
    activeTabs,
    anchor,
    chartStates: includeChartState ? chartStates : undefined,
    includeChartState,
  });

  return url;
};

const getActiveTabs = () => store?.getState()?.dashboardState?.activeTabs || [];

const getDataMask = () => store?.getState()?.dataMask || {};

const isDashboardHydrated = () => Boolean(store?.getState()?.dashboardInfo?.id);

const applyDataMask = (dataMask: DataMaskStateWithId) => {
  // The dashboard's own data mask holds an entry for every native filter and
  // every cross-filter-capable chart, so it doubles as the set of filter ids
  // this dashboard can accept. Anything else — a filter id from a different
  // dashboard, or the change-trigger flags that `observeDataMask` emits
  // alongside the mask — would otherwise be inserted as a bogus filter and
  // treated as a globally scoped filter by the active-filter derivation.
  const knownFilterIds = new Set(Object.keys(getDataMask()));
  const entries = Object.entries(dataMask);
  const applicable = entries.filter(([id]) => knownFilterIds.has(id));
  const ignored = entries.filter(([id]) => !knownFilterIds.has(id));

  if (ignored.length) {
    logging.warn(
      '[superset] setDataMask ignored unknown filter ids:',
      ignored.map(([id]) => id).join(', '),
    );
  }

  batch(() => {
    applicable.forEach(([filterId, mask]) => {
      store?.dispatch(updateDataMask(filterId, mask));
    });
  });
};

// A mask requested before the dashboard hydrates cannot be applied yet: the
// store holds no filter entries to validate the ids against, and hydration
// would replace anything dispatched in the meantime. Hold the request and
// replay it once hydration lands.
let queuedDataMask: DataMaskStateWithId | undefined;
let unsubscribeFromHydration: (() => void) | undefined;

const setDataMask = ({ dataMask }: { dataMask: DataMaskStateWithId }) => {
  if (isDashboardHydrated()) {
    applyDataMask(dataMask);
    return;
  }

  queuedDataMask = { ...queuedDataMask, ...dataMask };
  unsubscribeFromHydration ??= store?.subscribe(() => {
    if (!isDashboardHydrated()) return;
    unsubscribeFromHydration?.();
    unsubscribeFromHydration = undefined;
    const pending = queuedDataMask;
    queuedDataMask = undefined;
    if (pending) applyDataMask(pending);
  });
};

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
  setDataMask,
};
