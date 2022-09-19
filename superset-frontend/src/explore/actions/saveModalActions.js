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
import { SupersetClient, t } from '@superset-ui/core';
import { addSuccessToast } from 'src/components/MessageToasts/actions';
import { buildV1ChartDataPayload } from '../exploreUtils';

const ADHOC_FILTER_REGEX = /^adhoc_filters/;

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

export const getSlicePayload = (
  sliceName,
  formDataWithNativeFilters,
  owners,
) => {
  const adhocFilters = Object.entries(formDataWithNativeFilters).reduce(
    (acc, [key, value]) =>
      ADHOC_FILTER_REGEX.test(key)
        ? { ...acc, [key]: value?.filter(f => !f.isExtra) }
        : acc,
    {},
  );
  const formData = {
    ...formDataWithNativeFilters,
    ...adhocFilters,
  };

  const [datasourceId, datasourceType] = formData.datasource.split('__');
  const payload = {
    params: JSON.stringify(formData),
    slice_name: sliceName,
    viz_type: formData.viz_type,
    datasource_id: parseInt(datasourceId, 10),
    datasource_type: datasourceType,
    dashboards: formData.dashboards,
    owners,
    query_context: JSON.stringify(
      buildV1ChartDataPayload({
        formData,
        force: false,
        resultFormat: 'json',
        resultType: 'full',
        setDataMask: null,
        ownState: null,
      }),
    ),
  };
  return payload;
};

const addToasts = (isNewSlice, sliceName, addedToDashboard) => {
  const toasts = [];
  if (isNewSlice) {
    toasts.push(addSuccessToast(t('Chart [%s] has been saved', sliceName)));
  } else {
    toasts.push(
      addSuccessToast(t('Chart [%s] has been overwritten', sliceName)),
    );
  }

  if (addedToDashboard) {
    if (addedToDashboard.new) {
      toasts.push(
        addSuccessToast(
          t(
            'Dashboard [%s] just got created and chart [%s] was added to it',
            addedToDashboard.title,
            sliceName,
          ),
        ),
      );
    } else {
      toasts.push(
        addSuccessToast(
          t(
            'Chart [%s] was added to dashboard [%s]',
            sliceName,
            addedToDashboard.title,
          ),
        ),
      );
    }
  }

  return toasts;
};

//  Update existing slice
export const updateSlice =
  ({ slice_id: sliceId, owners }, sliceName, addedToDashboard) =>
  async (dispatch, getState) => {
    const {
      explore: {
        form_data: { url_params: _, ...formData },
      },
    } = getState();
    try {
      const response = await SupersetClient.put({
        endpoint: `/api/v1/chart/${sliceId}`,
        jsonPayload: getSlicePayload(sliceName, formData, owners),
      });

      dispatch(saveSliceSuccess());
      addToasts(false, sliceName, addedToDashboard).map(dispatch);
      return response.json;
    } catch (error) {
      dispatch(saveSliceFailed());
      throw error;
    }
  };

//  Create new slice
export const createSlice =
  (sliceName, addedToDashboard) => async (dispatch, getState) => {
    const {
      explore: {
        form_data: { url_params: _, ...formData },
      },
    } = getState();
    try {
      const response = await SupersetClient.post({
        endpoint: `/api/v1/chart/`,
        jsonPayload: getSlicePayload(sliceName, formData),
      });

      dispatch(saveSliceSuccess());
      addToasts(true, sliceName, addedToDashboard).map(dispatch);
      return response.json;
    } catch (error) {
      dispatch(saveSliceFailed());
      throw error;
    }
  };

//  Create new dashboard
export const createDashboard = dashboardName => async dispatch => {
  try {
    const response = await SupersetClient.post({
      endpoint: `/api/v1/dashboard/`,
      jsonPayload: { dashboard_title: dashboardName },
    });

    return response.json;
  } catch (error) {
    dispatch(saveSliceFailed());
    throw error;
  }
};

//  Get existing dashboard from ID
export const getDashboard = dashboardId => async dispatch => {
  try {
    const response = await SupersetClient.get({
      endpoint: `/api/v1/dashboard/${dashboardId}`,
    });

    return response.json;
  } catch (error) {
    dispatch(saveSliceFailed());
    throw error;
  }
};
