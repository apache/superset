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
import { SupersetClient } from '@superset-ui/connection';
import { getExploreUrl } from '../exploreUtils';

export const FETCH_DASHBOARDS_SUCCEEDED = 'FETCH_DASHBOARDS_SUCCEEDED';
export function fetchDashboardsSucceeded(choices) {
  return { type: FETCH_DASHBOARDS_SUCCEEDED, choices };
}

export const FETCH_DASHBOARDS_FAILED = 'FETCH_DASHBOARDS_FAILED';
export function fetchDashboardsFailed(userId) {
  return { type: FETCH_DASHBOARDS_FAILED, userId };
}

export function fetchDashboards(userId) {
  return function fetchDashboardsThunk(dispatch) {
    return SupersetClient.get({
      endpoint: `/dashboardasync/api/read?_flt_0_owners=${userId}`,
    })
      .then(({ json }) => {
        const choices = json.pks.map((id, index) => ({
          value: id,
          label: (json.result[index] || {}).dashboard_title,
        }));

        return dispatch(fetchDashboardsSucceeded(choices));
      })
      .catch(() => dispatch(fetchDashboardsFailed(userId)));
  };
}

export const SAVE_SLICE_FAILED = 'SAVE_SLICE_FAILED';
export function saveSliceFailed() {
  return { type: SAVE_SLICE_FAILED };
}
export const SAVE_SLICE_SUCCESS = 'SAVE_SLICE_SUCCESS';
export function saveSliceSuccess(data) {
  return { type: SAVE_SLICE_SUCCESS, data };
}

export const REMOVE_SAVE_MODAL_ALERT = 'REMOVE_SAVE_MODAL_ALERT';
export function removeSaveModalAlert() {
  return { type: REMOVE_SAVE_MODAL_ALERT };
}

export function saveSlice(formData, requestParams) {
  return dispatch => {
    const url = getExploreUrl({
      formData,
      endpointType: 'base',
      force: false,
      curUrl: null,
      requestParams,
    });

    return SupersetClient.post({ url, postPayload: { form_data: formData } })
      .then(({ json }) => dispatch(saveSliceSuccess(json)))
      .catch(() => dispatch(saveSliceFailed()));
  };
}
