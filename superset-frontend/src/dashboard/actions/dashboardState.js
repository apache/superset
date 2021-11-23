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
/* eslint camelcase: 0 */
import { ActionCreators as UndoActionCreators } from 'redux-undo';
import { t, SupersetClient } from '@superset-ui/core';
import { addChart, removeChart, refreshChart } from 'src/chart/chartAction';
import { chart as initChart } from 'src/chart/chartReducer';
import { applyDefaultFormData } from 'src/explore/store';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { SAVE_TYPE_OVERWRITE } from 'src/dashboard/util/constants';
import {
  addSuccessToast,
  addWarningToast,
  addDangerToast,
} from 'src/components/MessageToasts/actions';
import serializeActiveFilterValues from 'src/dashboard/util/serializeActiveFilterValues';
import serializeFilterScopes from 'src/dashboard/util/serializeFilterScopes';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { safeStringify } from 'src/utils/safeStringify';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { UPDATE_COMPONENTS_PARENTS_LIST } from './dashboardLayout';
import { setChartConfiguration } from './dashboardInfo';
import { fetchDatasourceMetadata } from './datasources';
import {
  addFilter,
  removeFilter,
  updateDirectPathToFilter,
} from './dashboardFilters';

export const SET_UNSAVED_CHANGES = 'SET_UNSAVED_CHANGES';
export function setUnsavedChanges(hasUnsavedChanges) {
  return { type: SET_UNSAVED_CHANGES, payload: { hasUnsavedChanges } };
}

export const ADD_SLICE = 'ADD_SLICE';
export function addSlice(slice) {
  return { type: ADD_SLICE, slice };
}

export const REMOVE_SLICE = 'REMOVE_SLICE';
export function removeSlice(sliceId) {
  return { type: REMOVE_SLICE, sliceId };
}

const FAVESTAR_BASE_URL = '/superset/favstar/Dashboard';
export const TOGGLE_FAVE_STAR = 'TOGGLE_FAVE_STAR';
export function toggleFaveStar(isStarred) {
  return { type: TOGGLE_FAVE_STAR, isStarred };
}

export const FETCH_FAVE_STAR = 'FETCH_FAVE_STAR';
export function fetchFaveStar(id) {
  return function fetchFaveStarThunk(dispatch) {
    return SupersetClient.get({
      endpoint: `${FAVESTAR_BASE_URL}/${id}/count/`,
    })
      .then(({ json }) => {
        if (json.count > 0) dispatch(toggleFaveStar(true));
      })
      .catch(() =>
        dispatch(
          addDangerToast(
            t(
              'There was an issue fetching the favorite status of this dashboard.',
            ),
          ),
        ),
      );
  };
}

export const SAVE_FAVE_STAR = 'SAVE_FAVE_STAR';
export function saveFaveStar(id, isStarred) {
  return function saveFaveStarThunk(dispatch) {
    const urlSuffix = isStarred ? 'unselect' : 'select';
    return SupersetClient.get({
      endpoint: `${FAVESTAR_BASE_URL}/${id}/${urlSuffix}/`,
    })
      .then(() => {
        dispatch(toggleFaveStar(!isStarred));
      })
      .catch(() =>
        dispatch(
          addDangerToast(t('There was an issue favoriting this dashboard.')),
        ),
      );
  };
}

export const TOGGLE_PUBLISHED = 'TOGGLE_PUBLISHED';
export function togglePublished(isPublished) {
  return { type: TOGGLE_PUBLISHED, isPublished };
}

export function savePublished(id, isPublished) {
  return function savePublishedThunk(dispatch) {
    return SupersetClient.put({
      endpoint: `/api/v1/dashboard/${id}`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        published: isPublished,
      }),
    })
      .then(() => {
        dispatch(
          addSuccessToast(
            isPublished
              ? t('This dashboard is now published')
              : t('This dashboard is now hidden'),
          ),
        );
        dispatch(togglePublished(isPublished));
      })
      .catch(() => {
        dispatch(
          addDangerToast(
            t('You do not have permissions to edit this dashboard.'),
          ),
        );
      });
  };
}

export const TOGGLE_EXPAND_SLICE = 'TOGGLE_EXPAND_SLICE';
export function toggleExpandSlice(sliceId) {
  return { type: TOGGLE_EXPAND_SLICE, sliceId };
}

export const UPDATE_CSS = 'UPDATE_CSS';
export function updateCss(css) {
  return { type: UPDATE_CSS, css };
}

export const SET_EDIT_MODE = 'SET_EDIT_MODE';
export function setEditMode(editMode) {
  return { type: SET_EDIT_MODE, editMode };
}

export const ON_CHANGE = 'ON_CHANGE';
export function onChange() {
  return { type: ON_CHANGE };
}

export const ON_SAVE = 'ON_SAVE';
export function onSave(lastModifiedTime) {
  return { type: ON_SAVE, lastModifiedTime };
}

export const SET_REFRESH_FREQUENCY = 'SET_REFRESH_FREQUENCY';
export function setRefreshFrequency(refreshFrequency, isPersistent = false) {
  return { type: SET_REFRESH_FREQUENCY, refreshFrequency, isPersistent };
}

export function saveDashboardRequestSuccess(lastModifiedTime) {
  return dispatch => {
    dispatch(onSave(lastModifiedTime));
    // clear layout undo history
    dispatch(UndoActionCreators.clearHistory());
  };
}

export function saveDashboardRequest(data, id, saveType) {
  const path = saveType === SAVE_TYPE_OVERWRITE ? 'save_dash' : 'copy_dash';

  return (dispatch, getState) => {
    dispatch({ type: UPDATE_COMPONENTS_PARENTS_LIST });

    const { dashboardFilters, dashboardLayout } = getState();
    const layout = dashboardLayout.present;
    Object.values(dashboardFilters).forEach(filter => {
      const { chartId } = filter;
      const componentId = filter.directPathToFilter.slice().pop();
      const directPathToFilter = (layout[componentId]?.parents || []).slice();
      directPathToFilter.push(componentId);
      dispatch(updateDirectPathToFilter(chartId, directPathToFilter));
    });
    // serialize selected values for each filter field, grouped by filter id
    const serializedFilters = serializeActiveFilterValues(getActiveFilters());
    // serialize filter scope for each filter field, grouped by filter id
    const serializedFilterScopes = serializeFilterScopes(dashboardFilters);
    return SupersetClient.post({
      endpoint: `/superset/${path}/${id}/`,
      postPayload: {
        data: {
          ...data,
          default_filters: safeStringify(serializedFilters),
          filter_scopes: safeStringify(serializedFilterScopes),
        },
      },
    })
      .then(response => {
        if (isFeatureEnabled(FeatureFlag.DASHBOARD_CROSS_FILTERS)) {
          const {
            dashboardInfo: {
              metadata: { chart_configuration = {} },
            },
          } = getState();
          const chartConfiguration = Object.values(chart_configuration).reduce(
            (prev, next) => {
              // If chart removed from dashboard - remove it from metadata
              if (
                Object.values(layout).find(
                  layoutItem => layoutItem?.meta?.chartId === next.id,
                )
              ) {
                return { ...prev, [next.id]: next };
              }
              return prev;
            },
            {},
          );
          dispatch(setChartConfiguration(chartConfiguration));
        }
        dispatch(saveDashboardRequestSuccess(response.json.last_modified_time));
        dispatch(addSuccessToast(t('This dashboard was saved successfully.')));
        return response;
      })
      .catch(response =>
        getClientErrorObject(response).then(({ error }) =>
          dispatch(
            addDangerToast(
              t('Sorry, there was an error saving this dashboard: %s', error),
            ),
          ),
        ),
      );
  };
}

export function fetchCharts(
  chartList = [],
  force = false,
  interval = 0,
  dashboardId,
) {
  return (dispatch, getState) => {
    if (!interval) {
      chartList.forEach(chartKey =>
        dispatch(refreshChart(chartKey, force, dashboardId)),
      );
      return;
    }

    const { metadata: meta } = getState().dashboardInfo;
    const refreshTime = Math.max(interval, meta.stagger_time || 5000); // default 5 seconds
    if (typeof meta.stagger_refresh !== 'boolean') {
      meta.stagger_refresh =
        meta.stagger_refresh === undefined
          ? true
          : meta.stagger_refresh === 'true';
    }
    const delay = meta.stagger_refresh
      ? refreshTime / (chartList.length - 1)
      : 0;
    chartList.forEach((chartKey, i) => {
      setTimeout(
        () => dispatch(refreshChart(chartKey, force, dashboardId)),
        delay * i,
      );
    });
  };
}

const refreshCharts = (chartList, force, interval, dashboardId, dispatch) =>
  new Promise(resolve => {
    dispatch(fetchCharts(chartList, force, interval, dashboardId));
    resolve();
  });

export const ON_REFRESH_SUCCESS = 'ON_REFRESH_SUCCESS';
export function onRefreshSuccess() {
  return { type: ON_REFRESH_SUCCESS };
}

export const ON_REFRESH = 'ON_REFRESH';
export function onRefresh(
  chartList = [],
  force = false,
  interval = 0,
  dashboardId,
) {
  return dispatch => {
    dispatch({ type: ON_REFRESH });
    refreshCharts(chartList, force, interval, dashboardId, dispatch).then(() =>
      dispatch({ type: ON_REFRESH_SUCCESS }),
    );
  };
}

export const SHOW_BUILDER_PANE = 'SHOW_BUILDER_PANE';
export function showBuilderPane() {
  return { type: SHOW_BUILDER_PANE };
}

export function addSliceToDashboard(id, component) {
  return (dispatch, getState) => {
    const { sliceEntities } = getState();
    const selectedSlice = sliceEntities.slices[id];
    if (!selectedSlice) {
      return dispatch(
        addWarningToast(
          'Sorry, there is no chart definition associated with the chart trying to be added.',
        ),
      );
    }
    const form_data = {
      ...selectedSlice.form_data,
      slice_id: selectedSlice.slice_id,
    };
    const newChart = {
      ...initChart,
      id,
      form_data,
      formData: applyDefaultFormData(form_data),
    };

    return Promise.all([
      dispatch(addChart(newChart, id)),
      dispatch(fetchDatasourceMetadata(form_data.datasource)),
    ]).then(() => {
      dispatch(addSlice(selectedSlice));

      if (selectedSlice && selectedSlice.viz_type === 'filter_box') {
        dispatch(addFilter(id, component, selectedSlice.form_data));
      }
    });
  };
}

export function removeSliceFromDashboard(id) {
  return (dispatch, getState) => {
    const sliceEntity = getState().sliceEntities.slices[id];
    if (sliceEntity && sliceEntity.viz_type === 'filter_box') {
      dispatch(removeFilter(id));
    }

    dispatch(removeSlice(id));
    dispatch(removeChart(id));
  };
}

export const SET_COLOR_SCHEME = 'SET_COLOR_SCHEME';
export function setColorScheme(colorScheme) {
  return { type: SET_COLOR_SCHEME, colorScheme };
}

export function setColorSchemeAndUnsavedChanges(colorScheme) {
  return dispatch => {
    dispatch(setColorScheme(colorScheme));
    dispatch(setUnsavedChanges(true));
  };
}

export const SET_DIRECT_PATH = 'SET_DIRECT_PATH';
export function setDirectPathToChild(path) {
  return { type: SET_DIRECT_PATH, path };
}

export const SET_ACTIVE_TABS = 'SET_ACTIVE_TABS';
export function setActiveTabs(tabId, prevTabId) {
  return { type: SET_ACTIVE_TABS, tabId, prevTabId };
}

export const SET_FOCUSED_FILTER_FIELD = 'SET_FOCUSED_FILTER_FIELD';
export function setFocusedFilterField(chartId, column) {
  return { type: SET_FOCUSED_FILTER_FIELD, chartId, column };
}

export const UNSET_FOCUSED_FILTER_FIELD = 'UNSET_FOCUSED_FILTER_FIELD';
export function unsetFocusedFilterField(chartId, column) {
  return { type: UNSET_FOCUSED_FILTER_FIELD, chartId, column };
}

export const SET_FULL_SIZE_CHART_ID = 'SET_FULL_SIZE_CHART_ID';
export function setFullSizeChartId(chartId) {
  return { type: SET_FULL_SIZE_CHART_ID, chartId };
}

// Undo history ---------------------------------------------------------------
export const SET_MAX_UNDO_HISTORY_EXCEEDED = 'SET_MAX_UNDO_HISTORY_EXCEEDED';
export function setMaxUndoHistoryExceeded(maxUndoHistoryExceeded = true) {
  return {
    type: SET_MAX_UNDO_HISTORY_EXCEEDED,
    payload: { maxUndoHistoryExceeded },
  };
}

export function maxUndoHistoryToast() {
  return (dispatch, getState) => {
    const { dashboardLayout } = getState();
    const historyLength = dashboardLayout.past.length;

    return dispatch(
      addWarningToast(
        `You have used all ${historyLength} undo slots and will not be able to fully undo subsequent actions. You may save your current state to reset the history.`,
      ),
    );
  };
}
