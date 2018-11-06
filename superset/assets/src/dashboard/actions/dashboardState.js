/* eslint camelcase: 0 */
import { ActionCreators as UndoActionCreators } from 'redux-undo';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';

import { addChart, removeChart, refreshChart } from '../../chart/chartAction';
import { chart as initChart } from '../../chart/chartReducer';
import { fetchDatasourceMetadata } from '../../dashboard/actions/datasources';
import { applyDefaultFormData } from '../../explore/store';
import getClientErrorObject from '../../utils/getClientErrorObject';
import {
  Logger,
  LOG_ACTIONS_CHANGE_DASHBOARD_FILTER,
  LOG_ACTIONS_REFRESH_DASHBOARD,
} from '../../logger';
import { SAVE_TYPE_OVERWRITE } from '../util/constants';
import {
  addSuccessToast,
  addWarningToast,
  addDangerToast,
} from '../../messageToasts/actions';

export const SET_UNSAVED_CHANGES = 'SET_UNSAVED_CHANGES';
export function setUnsavedChanges(hasUnsavedChanges) {
  return { type: SET_UNSAVED_CHANGES, payload: { hasUnsavedChanges } };
}

export const CHANGE_FILTER = 'CHANGE_FILTER';
export function changeFilter(chart, col, vals, merge = true, refresh = true) {
  Logger.append(LOG_ACTIONS_CHANGE_DASHBOARD_FILTER, {
    id: chart.id,
    column: col,
    value_count: Array.isArray(vals) ? vals.length : (vals && 1) || 0,
    merge,
    refresh,
  });
  return { type: CHANGE_FILTER, chart, col, vals, merge, refresh };
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
      endpoint: `${FAVESTAR_BASE_URL}/${id}/count`,
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
export function onSave() {
  return { type: ON_SAVE };
}

export function saveDashboardRequestSuccess() {
  return dispatch => {
    dispatch(onSave());
    // clear layout undo history
    dispatch(UndoActionCreators.clearHistory());
  };
}

export function saveDashboardRequest(data, id, saveType) {
  const path = saveType === SAVE_TYPE_OVERWRITE ? 'save_dash' : 'copy_dash';

  return dispatch =>
    SupersetClient.post({
      endpoint: `/superset/${path}/${id}/`,
      postPayload: { data },
    })
      .then(response =>
        Promise.all([
          dispatch(saveDashboardRequestSuccess()),
          dispatch(
            addSuccessToast(t('This dashboard was saved successfully.')),
          ),
        ]).then(() => Promise.resolve(response)),
      )
      .catch(response =>
        getClientErrorObject(response).then(({ error }) =>
          dispatch(
            addDangerToast(
              `${t(
                'Sorry, there was an error saving this dashboard: ',
              )} ${error}}`,
            ),
          ),
        ),
      );
}

export function fetchCharts(chartList = [], force = false, interval = 0) {
  return (dispatch, getState) => {
    Logger.append(LOG_ACTIONS_REFRESH_DASHBOARD, {
      force,
      interval,
      chartCount: chartList.length,
    });
    const timeout = getState().dashboardInfo.common.conf
      .SUPERSET_WEBSERVER_TIMEOUT;
    if (!interval) {
      chartList.forEach(chart => dispatch(refreshChart(chart, force, timeout)));
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
    chartList.forEach((chart, i) => {
      setTimeout(
        () => dispatch(refreshChart(chart, force, timeout)),
        delay * i,
      );
    });
  };
}

let refreshTimer = null;
export function startPeriodicRender(interval) {
  const stopPeriodicRender = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  };

  return (dispatch, getState) => {
    stopPeriodicRender();

    const { metadata } = getState().dashboardInfo;
    const immune = metadata.timed_refresh_immune_slices || [];
    const refreshAll = () => {
      const affected = Object.values(getState().charts).filter(
        chart => immune.indexOf(chart.id) === -1,
      );
      return dispatch(fetchCharts(affected, true, interval * 0.2));
    };
    const fetchAndRender = () => {
      refreshAll();
      if (interval > 0) {
        refreshTimer = setTimeout(fetchAndRender, interval);
      }
    };

    fetchAndRender();
  };
}

export const TOGGLE_BUILDER_PANE = 'TOGGLE_BUILDER_PANE';
export function toggleBuilderPane() {
  return { type: TOGGLE_BUILDER_PANE };
}

export function addSliceToDashboard(id) {
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
    const form_data = selectedSlice.form_data;
    const newChart = {
      ...initChart,
      id,
      form_data,
      formData: applyDefaultFormData(form_data),
    };

    return Promise.all([
      dispatch(addChart(newChart, id)),
      dispatch(fetchDatasourceMetadata(form_data.datasource)),
    ]).then(() => dispatch(addSlice(selectedSlice)));
  };
}

export function removeSliceFromDashboard(id) {
  return dispatch => {
    dispatch(removeSlice(id));
    dispatch(removeChart(id));
  };
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
