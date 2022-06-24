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
import shortid from 'shortid';
import {
  DatasourceType,
  ensureIsArray,
  JsonObject,
  QueryFormData,
} from '@superset-ui/core';
import { ControlStateMapping, Dataset } from '@superset-ui/chart-controls';
import {
  CommonBootstrapData,
  UserWithPermissionsAndRoles,
} from 'src/types/bootstrapTypes';
import getToastsFromPyFlashMessages from 'src/components/MessageToasts/getToastsFromPyFlashMessages';

import { ChartState, Slice } from 'src/explore/types';
import { getChartKey } from 'src/explore/exploreUtils';
import { getControlsState } from 'src/explore/store';
import {
  getFormDataFromControls,
  applyMapStateToPropsToControl,
} from 'src/explore/controlUtils';
import { findPermission } from 'src/utils/findPermission';
import { getDatasourceUid } from 'src/utils/getDatasourceUid';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';

export interface ExplorePageBootstrapData extends JsonObject {
  can_add: boolean;
  can_download: boolean;
  can_overwrite: boolean;
  common: CommonBootstrapData;
  datasource: Dataset;
  datasource_id: number;
  datasource_type: DatasourceType;
  forced_height: string | null;
  form_data: QueryFormData;
  slice: Slice | null;
  standalone: boolean;
  force: boolean;
  user: UserWithPermissionsAndRoles;
}

export default function getInitialState(
  bootstrapData: ExplorePageBootstrapData,
) {
  const {
    form_data: initialFormData,
    common,
    user,
    datasource,
    slice,
  } = bootstrapData;

  const exploreState = {
    // note this will add `form_data` to state,
    // which will be manipulatable by future reducers.
    can_add: findPermission('can_write', 'Chart', user?.roles),
    can_download: findPermission('can_csv', 'Superset', user?.roles),
    can_overwrite: ensureIsArray(slice?.owners).includes(
      user?.userId as number,
    ),
    isDatasourceMetaLoading: false,
    isStarred: false,
    triggerRender: false,
    // duplicate datasource in exploreState - it's needed by getControlsState
    datasource,
    // Initial control state will skip `control.mapStateToProps`
    // because `bootstrapData.controls` is undefined.
    controls: getControlsState(
      bootstrapData,
      initialFormData,
    ) as ControlStateMapping,
    form_data: initialFormData,
    slice,
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
  const sliceFormData = slice
    ? getFormDataFromControls(getControlsState(bootstrapData, slice.form_data))
    : null;

  const chartKey: number = getChartKey(bootstrapData);
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

  return {
    common: common || {},
    user: user || {},
    charts: {
      [chartKey]: chart,
    },
    datasources: { [getDatasourceUid(datasource)]: datasource },
    saveModal: {
      dashboards: [],
      saveModalAlert: null,
    },
    explore: exploreState,
    impressionId: shortid.generate(),
    messageToasts: getToastsFromPyFlashMessages(
      (bootstrapData.common || {}).flash_messages || [],
    ),
  };
}

export type ExplorePageState = ReturnType<typeof getInitialState>;
