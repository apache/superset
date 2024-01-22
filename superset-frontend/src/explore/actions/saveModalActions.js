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
import rison from 'rison';
import { SupersetClient, t } from '@superset-ui/core';
import { addSuccessToast } from 'src/components/MessageToasts/actions';
import { isEmpty } from 'lodash';
import { buildV1ChartDataPayload } from '../exploreUtils';
import { Operators } from '../constants';

const ADHOC_FILTER_REGEX = /^adhoc_filters/;

export const FETCH_DASHBOARDS_SUCCEEDED = 'FETCH_DASHBOARDS_SUCCEEDED';
export function fetchDashboardsSucceeded(choices) {
  return { type: FETCH_DASHBOARDS_SUCCEEDED, choices };
}

export const FETCH_DASHBOARDS_FAILED = 'FETCH_DASHBOARDS_FAILED';
export function fetchDashboardsFailed(userId) {
  return { type: FETCH_DASHBOARDS_FAILED, userId };
}

export const SET_SAVE_CHART_MODAL_VISIBILITY =
  'SET_SAVE_CHART_MODAL_VISIBILITY';
export function setSaveChartModalVisibility(isVisible) {
  return { type: SET_SAVE_CHART_MODAL_VISIBILITY, isVisible };
}

export const SAVE_SLICE_FAILED = 'SAVE_SLICE_FAILED';
export function saveSliceFailed() {
  return { type: SAVE_SLICE_FAILED };
}
export const SAVE_SLICE_SUCCESS = 'SAVE_SLICE_SUCCESS';
export function saveSliceSuccess(data) {
  return { type: SAVE_SLICE_SUCCESS, data };
}

const extractAdhocFiltersFromFormData = formDataToHandle =>
  Object.entries(formDataToHandle).reduce(
    (acc, [key, value]) =>
      ADHOC_FILTER_REGEX.test(key)
        ? { ...acc, [key]: value?.filter(f => !f.isExtra) }
        : acc,
    {},
  );

const hasTemporalRangeFilter = formData =>
  (formData?.adhoc_filters || []).some(
    filter => filter.operator === Operators.TEMPORAL_RANGE,
  );

export const getSlicePayload = (
  sliceName,
  formDataWithNativeFilters,
  dashboards,
  owners,
  formDataFromSlice = {},
) => {
  const adhocFilters = extractAdhocFiltersFromFormData(
    formDataWithNativeFilters,
  );

  // Retain adhoc_filters from the slice if no adhoc_filters are present
  // after overwriting a chart.  This ensures the dashboard can continue
  // to filter the chart. Before, any time range filter applied in the dashboard
  // would end up as an extra filter and when overwriting the chart the original
  // time range adhoc_filter was lost
  if (!isEmpty(formDataFromSlice)) {
    Object.keys(adhocFilters || {}).forEach(adhocFilterKey => {
      if (isEmpty(adhocFilters[adhocFilterKey])) {
        formDataFromSlice?.[adhocFilterKey]?.forEach(filter => {
          if (filter.operator === Operators.TEMPORAL_RANGE && !filter.isExtra) {
            adhocFilters[adhocFilterKey].push({
              ...filter,
              comparator: 'No filter',
            });
          }
        });
      }
    });
  }

  // This loop iterates through the adhoc_filters array in formDataWithNativeFilters.
  // If a filter is of type TEMPORAL_RANGE and isExtra, it sets its comparator to
  // 'No filter' and adds the modified filter to the adhocFilters array. This ensures that all
  // TEMPORAL_RANGE filters are converted to 'No filter' when saving a chart.
  if (!hasTemporalRangeFilter(adhocFilters)) {
    formDataWithNativeFilters?.adhoc_filters?.forEach(filter => {
      if (filter.operator === Operators.TEMPORAL_RANGE && filter.isExtra) {
        adhocFilters.adhoc_filters.push({ ...filter, comparator: 'No filter' });
      }
    });
  }

  const formData = {
    ...formDataWithNativeFilters,
    ...adhocFilters,
    dashboards,
  };

  const [datasourceId, datasourceType] = formData.datasource.split('__');
  const payload = {
    params: JSON.stringify(formData),
    slice_name: sliceName,
    viz_type: formData.viz_type,
    datasource_id: parseInt(datasourceId, 10),
    datasource_type: datasourceType,
    dashboards,
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
  (slice, sliceName, dashboards, addedToDashboard) =>
  async (dispatch, getState) => {
    const { slice_id: sliceId, owners, form_data: formDataFromSlice } = slice;
    const {
      explore: {
        form_data: { url_params: _, ...formData },
      },
    } = getState();
    try {
      const response = await SupersetClient.put({
        endpoint: `/api/v1/chart/${sliceId}`,
        jsonPayload: getSlicePayload(
          sliceName,
          formData,
          dashboards,
          owners,
          formDataFromSlice,
        ),
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
  (sliceName, dashboards, addedToDashboard) => async (dispatch, getState) => {
    const {
      explore: {
        form_data: { url_params: _, ...formData },
      },
    } = getState();
    try {
      const response = await SupersetClient.post({
        endpoint: `/api/v1/chart/`,
        jsonPayload: getSlicePayload(sliceName, formData, dashboards),
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

//  Get dashboards the slice is added to
export const getSliceDashboards = slice => async dispatch => {
  try {
    const response = await SupersetClient.get({
      endpoint: `/api/v1/chart/${slice.slice_id}?q=${rison.encode({
        columns: ['dashboards.id'],
      })}`,
    });

    return response.json.result.dashboards.map(({ id }) => id);
  } catch (error) {
    dispatch(saveSliceFailed());
    throw error;
  }
};
