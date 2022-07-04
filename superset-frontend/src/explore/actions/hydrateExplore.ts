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
import { ControlStateMapping } from '@superset-ui/chart-controls';

import {
  ChartState,
  ExplorePageInitialData,
  ExplorePageState,
} from 'src/explore/types';
import { getChartKey } from 'src/explore/exploreUtils';
import { getControlsState } from 'src/explore/store';
import { Dispatch } from 'redux';
import { ensureIsArray } from '@superset-ui/core';
import {
  getFormDataFromControls,
  applyMapStateToPropsToControl,
} from 'src/explore/controlUtils';
import { getDatasourceUid } from 'src/utils/getDatasourceUid';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';
import { findPermission } from 'src/utils/findPermission';

export const HYDRATE_EXPLORE = 'HYDRATE_EXPLORE';
export const hydrateExplore =
  ({ form_data, slice, dataset }: ExplorePageInitialData) =>
  (dispatch: Dispatch, getState: () => ExplorePageState) => {
    const { user, datasources, charts, sliceEntities, common } = getState();

    const sliceId = getUrlParam(URL_PARAMS.sliceId);
    const dashboardId = getUrlParam(URL_PARAMS.dashboardId);
    const fallbackSlice = sliceId ? sliceEntities?.slices?.[sliceId] : null;
    const initialSlice = slice ?? fallbackSlice;
    const initialFormData = form_data ?? initialSlice?.form_data;
    if (!initialFormData.viz_type) {
      const defaultVizType = common?.conf.DEFAULT_VIZ_TYPE || 'table';
      initialFormData.viz_type =
        getUrlParam(URL_PARAMS.vizType) || defaultVizType;
    }
    if (dashboardId) {
      initialFormData.dashboardId = dashboardId;
    }
    const initialDatasource =
      datasources?.[initialFormData.datasource] ?? dataset;

    const initialExploreState = {
      form_data: initialFormData,
      slice: initialSlice,
      datasource: initialDatasource,
    };
    const initialControls = getControlsState(
      initialExploreState,
      initialFormData,
    ) as ControlStateMapping;

    const exploreState = {
      // note this will add `form_data` to state,
      // which will be manipulable by future reducers.
      can_add: findPermission('can_write', 'Chart', user?.roles),
      can_download: findPermission('can_csv', 'Superset', user?.roles),
      can_overwrite: ensureIsArray(slice?.owners).includes(
        user?.userId as number,
      ),
      isDatasourceMetaLoading: false,
      isStarred: false,
      triggerRender: false,
      // duplicate datasource in exploreState - it's needed by getControlsState
      datasource: initialDatasource,
      // Initial control state will skip `control.mapStateToProps`
      // because `bootstrapData.controls` is undefined.
      controls: initialControls,
      form_data: initialFormData,
      slice: initialSlice,
      controlsTransferred: [],
      standalone: getUrlParam(URL_PARAMS.standalone),
      force: getUrlParam(URL_PARAMS.force),
    };

    // apply initial mapStateToProps for all controls, must execute AFTER
    // bootstrapState has initialized `controls`. Order of execution is not
    // guaranteed, so controls shouldn't rely on each other's mapped state.
    Object.entries(exploreState.controls).forEach(([key, controlState]) => {
      exploreState.controls[key] = applyMapStateToPropsToControl(
        controlState,
        exploreState,
      );
    });
    const sliceFormData = initialSlice
      ? getFormDataFromControls(initialControls)
      : null;

    const chartKey: number = getChartKey(initialExploreState);
    const chart: ChartState = {
      id: chartKey,
      chartAlert: null,
      chartStatus: null,
      chartStackTrace: null,
      chartUpdateEndTime: null,
      chartUpdateStartTime: 0,
      latestQueryFormData: getFormDataFromControls(exploreState.controls),
      sliceFormData,
      queryController: null,
      queriesResponse: null,
      triggerQuery: false,
      lastRendered: 0,
    };

    return dispatch({
      type: HYDRATE_EXPLORE,
      data: {
        charts: {
          ...charts,
          [chartKey]: chart,
        },
        datasources: {
          ...datasources,
          [getDatasourceUid(initialDatasource)]: initialDatasource,
        },
        saveModal: {
          dashboards: [],
          saveModalAlert: null,
        },
        explore: exploreState,
      },
    });
  };

export type HydrateExplore = {
  type: typeof HYDRATE_EXPLORE;
  data: ExplorePageState;
};
