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

/**
 * Host-internal implementation of the `explore` namespace.
 *
 * Wraps Redux explore state and normalizes it into the stable `ChartContext`
 * contract. Extensions must not depend on the Redux slice structure directly.
 */

import type { explore as exploreApi } from '@apache-superset/core';
import { HYDRATE_EXPLORE } from 'src/explore/actions/hydrateExplore';
import {
  SET_FORM_DATA,
  UPDATE_CHART_TITLE,
} from 'src/explore/actions/exploreActions';
import { SET_DATASOURCE } from 'src/explore/actions/datasourcesActions';
import { store, RootState } from 'src/views/store';
import { AnyListenerPredicate } from '@reduxjs/toolkit';
import { createActionListener } from '../utils';

type ChartContext = exploreApi.ChartContext;

function buildChartContext(): ChartContext | undefined {
  const state = store.getState();
  const exploreState = (state as any).explore;
  if (!exploreState) return undefined;

  const { slice, datasource, controls } = exploreState;
  const vizType: string =
    (controls?.viz_type?.value as string) ??
    exploreState.form_data?.viz_type ??
    '';

  return {
    chartId: slice?.slice_id ?? null,
    chartName: exploreState.sliceName ?? slice?.slice_name ?? null,
    vizType,
    datasourceId: datasource?.id ?? null,
    datasourceName:
      datasource?.table_name ?? datasource?.datasource_name ?? null,
  };
}

const exploreChangePredicate: AnyListenerPredicate<RootState> = action =>
  action.type === HYDRATE_EXPLORE ||
  action.type === SET_FORM_DATA ||
  action.type === UPDATE_CHART_TITLE ||
  action.type === SET_DATASOURCE;

const getCurrentChart: typeof exploreApi.getCurrentChart = () =>
  buildChartContext();

const onDidChangeChart: typeof exploreApi.onDidChangeChart = (
  listener: (ctx: ChartContext) => void,
  thisArgs?: any,
) =>
  createActionListener<ChartContext>(
    exploreChangePredicate,
    listener,
    () => buildChartContext() ?? null,
    thisArgs,
  );

export const explore: typeof exploreApi = {
  getCurrentChart,
  onDidChangeChart,
};
