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
import rison from 'rison';
import {
  ensureIsArray,
  isFeatureEnabled,
  FeatureFlag,
  getLabelsColorMap,
  SupersetClient,
  t,
  getClientErrorObject,
  getCategoricalSchemeRegistry,
  promiseTimeout,
} from '@superset-ui/core';
import {
  addChart,
  removeChart,
  refreshChart,
} from 'src/components/Chart/chartAction';
import { chart as initChart } from 'src/components/Chart/chartReducer';
import { applyDefaultFormData } from 'src/explore/store';
import {
  SAVE_TYPE_OVERWRITE,
  SAVE_TYPE_OVERWRITE_CONFIRMED,
} from 'src/dashboard/util/constants';
import {
  getCrossFiltersConfiguration,
  isCrossFiltersEnabled,
} from 'src/dashboard/util/crossFilters';
import {
  addSuccessToast,
  addWarningToast,
  addDangerToast,
} from 'src/components/MessageToasts/actions';
import serializeActiveFilterValues from 'src/dashboard/util/serializeActiveFilterValues';
import serializeFilterScopes from 'src/dashboard/util/serializeFilterScopes';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { safeStringify } from 'src/utils/safeStringify';
import { logEvent } from 'src/logger/actions';
import { LOG_ACTIONS_CONFIRM_OVERWRITE_DASHBOARD_METADATA } from 'src/logger/LogUtils';
import { isEqual } from 'lodash';
import { UPDATE_COMPONENTS_PARENTS_LIST } from './dashboardLayout';
import {
  saveChartConfiguration,
  dashboardInfoChanged,
  SAVE_CHART_CONFIG_COMPLETE,
} from './dashboardInfo';
import { fetchDatasourceMetadata, setDatasources } from './datasources';
import { updateDirectPathToFilter } from './dashboardFilters';
import { SET_IN_SCOPE_STATUS_OF_FILTERS } from './nativeFilters';
import getOverwriteItems from '../util/getOverwriteItems';
import {
  applyColors,
  enforceSharedLabelsColorsArray,
  isLabelsColorMapSynced,
  getColorSchemeDomain,
  getColorNamespace,
  getFreshLabelsColorMapEntries,
  getFreshSharedLabels,
  getDynamicLabelsColors,
} from '../../utils/colorScheme';

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

export const TOGGLE_FAVE_STAR = 'TOGGLE_FAVE_STAR';
export function toggleFaveStar(isStarred) {
  return { type: TOGGLE_FAVE_STAR, isStarred };
}

export function fetchFaveStar(id) {
  return function fetchFaveStarThunk(dispatch) {
    return SupersetClient.get({
      endpoint: `/api/v1/dashboard/favorite_status/?q=${rison.encode([id])}`,
    })
      .then(({ json }) => {
        dispatch(toggleFaveStar(!!json?.result?.[0]?.value));
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

export function saveFaveStar(id, isStarred) {
  return function saveFaveStarThunk(dispatch) {
    const endpoint = `/api/v1/dashboard/${id}/favorites/`;
    const apiCall = isStarred
      ? SupersetClient.delete({
          endpoint,
        })
      : SupersetClient.post({ endpoint });

    return apiCall
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

export const SET_OVERRIDE_CONFIRM = 'SET_OVERRIDE_CONFIRM';
export function setOverrideConfirm(overwriteConfirmMetadata) {
  return {
    type: SET_OVERRIDE_CONFIRM,
    overwriteConfirmMetadata,
  };
}

export const SAVE_DASHBOARD_STARTED = 'SAVE_DASHBOARD_STARTED';
export function saveDashboardStarted() {
  return { type: SAVE_DASHBOARD_STARTED };
}

export const SAVE_DASHBOARD_FINISHED = 'SAVE_DASHBOARD_FINISHED';
export function saveDashboardFinished() {
  return { type: SAVE_DASHBOARD_FINISHED };
}

export const SET_DASHBOARD_LABELS_COLORMAP_SYNCABLE =
  'SET_DASHBOARD_LABELS_COLORMAP_SYNCABLE';
export const SET_DASHBOARD_LABELS_COLORMAP_SYNCED =
  'SET_DASHBOARD_LABELS_COLORMAP_SYNCED';
export const SET_DASHBOARD_SHARED_LABELS_COLORS_SYNCABLE =
  'SET_DASHBOARD_SHARED_LABELS_COLORS_SYNCABLE';
export const SET_DASHBOARD_SHARED_LABELS_COLORS_SYNCED =
  'SET_DASHBOARD_SHARED_LABELS_COLORS_SYNCED';

export function setDashboardLabelsColorMapSync() {
  return { type: SET_DASHBOARD_LABELS_COLORMAP_SYNCABLE };
}

export function setDashboardLabelsColorMapSynced() {
  return { type: SET_DASHBOARD_LABELS_COLORMAP_SYNCED };
}

export function setDashboardSharedLabelsColorsSync() {
  return { type: SET_DASHBOARD_SHARED_LABELS_COLORS_SYNCABLE };
}

export function setDashboardSharedLabelsColorsSynced() {
  return { type: SET_DASHBOARD_SHARED_LABELS_COLORS_SYNCED };
}

export const setDashboardMetadata =
  updatedMetadata => async (dispatch, getState) => {
    const { dashboardInfo } = getState();
    dispatch(
      dashboardInfoChanged({
        metadata: {
          ...(dashboardInfo?.metadata || {}),
          ...updatedMetadata,
        },
      }),
    );
  };

export function saveDashboardRequest(data, id, saveType) {
  return (dispatch, getState) => {
    dispatch({ type: UPDATE_COMPONENTS_PARENTS_LIST });
    dispatch(saveDashboardStarted());

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
    const {
      certified_by,
      certification_details,
      css,
      dashboard_title,
      owners,
      roles,
      slug,
    } = data;

    const hasId = item => item.id !== undefined;
    const metadataCrossFiltersEnabled = data.metadata?.cross_filters_enabled;
    const colorScheme = data.metadata?.color_scheme;
    const customLabelsColor = data.metadata?.label_colors || {};
    const sharedLabelsColor = enforceSharedLabelsColorsArray(
      data.metadata?.shared_label_colors,
    );
    const cleanedData = {
      ...data,
      certified_by: certified_by || '',
      certification_details:
        certified_by && certification_details ? certification_details : '',
      css: css || '',
      dashboard_title: dashboard_title || t('[ untitled dashboard ]'),
      owners: ensureIsArray(owners).map(o => (hasId(o) ? o.id : o)),
      roles: !isFeatureEnabled(FeatureFlag.DashboardRbac)
        ? undefined
        : ensureIsArray(roles).map(r => (hasId(r) ? r.id : r)),
      slug: slug || null,
      metadata: {
        ...data.metadata,
        color_namespace: getColorNamespace(data.metadata?.color_namespace),
        color_scheme: colorScheme || '',
        color_scheme_domain: colorScheme
          ? getColorSchemeDomain(colorScheme)
          : [],
        expanded_slices: data.metadata?.expanded_slices || {},
        label_colors: customLabelsColor,
        shared_label_colors: getFreshSharedLabels(sharedLabelsColor),
        map_label_colors: getFreshLabelsColorMapEntries(customLabelsColor),
        refresh_frequency: data.metadata?.refresh_frequency || 0,
        timed_refresh_immune_slices:
          data.metadata?.timed_refresh_immune_slices || [],
        // cross-filters should be enabled by default
        cross_filters_enabled: isCrossFiltersEnabled(
          metadataCrossFiltersEnabled,
        ),
      },
    };

    const handleChartConfiguration = () => {
      const {
        dashboardLayout,
        charts,
        dashboardInfo: { metadata },
      } = getState();
      return getCrossFiltersConfiguration(
        dashboardLayout.present,
        metadata,
        charts,
      );
    };

    const onCopySuccess = response => {
      const lastModifiedTime = response.json.result.last_modified_time;
      if (lastModifiedTime) {
        dispatch(saveDashboardRequestSuccess(lastModifiedTime));
      }
      const { chartConfiguration, globalChartConfiguration } =
        handleChartConfiguration();
      dispatch(
        saveChartConfiguration({
          chartConfiguration,
          globalChartConfiguration,
        }),
      );
      dispatch(saveDashboardFinished());
      dispatch(addSuccessToast(t('This dashboard was saved successfully.')));
      return response;
    };

    const onUpdateSuccess = response => {
      const updatedDashboard = response.json.result;
      const lastModifiedTime = response.json.last_modified_time;
      // syncing with the backend transformations of the metadata
      if (updatedDashboard.json_metadata) {
        const metadata = JSON.parse(updatedDashboard.json_metadata);
        dispatch(setDashboardMetadata(metadata));
        if (metadata.chart_configuration) {
          dispatch({
            type: SAVE_CHART_CONFIG_COMPLETE,
            chartConfiguration: metadata.chart_configuration,
          });
        }
        if (metadata.native_filter_configuration) {
          dispatch({
            type: SET_IN_SCOPE_STATUS_OF_FILTERS,
            filterConfig: metadata.native_filter_configuration,
          });
        }

        // fetch datasets to make sure they are up to date
        SupersetClient.get({
          endpoint: `/api/v1/dashboard/${id}/datasets`,
          headers: { 'Content-Type': 'application/json' },
        }).then(({ json }) => {
          const datasources = json?.result ?? [];
          if (datasources.length) {
            dispatch(setDatasources(datasources));
          }
        });
      }
      if (lastModifiedTime) {
        dispatch(saveDashboardRequestSuccess(lastModifiedTime));
      }
      dispatch(saveDashboardFinished());
      // redirect to the new slug or id
      window.history.pushState(
        { event: 'dashboard_properties_changed' },
        '',
        `/superset/dashboard/${slug || id}/`,
      );

      dispatch(addSuccessToast(t('This dashboard was saved successfully.')));
      dispatch(setOverrideConfirm(undefined));
      return response;
    };

    const onError = async response => {
      const { error, message } = await getClientErrorObject(response);
      let errorText = t('Sorry, an unknown error occurred');

      if (error) {
        errorText = t(
          'Sorry, there was an error saving this dashboard: %s',
          error,
        );
      }
      if (typeof message === 'string' && message === 'Forbidden') {
        errorText = t('You do not have permission to edit this dashboard');
      }
      dispatch(saveDashboardFinished());
      dispatch(addDangerToast(errorText));
    };

    if (
      [SAVE_TYPE_OVERWRITE, SAVE_TYPE_OVERWRITE_CONFIRMED].includes(saveType)
    ) {
      const { chartConfiguration, globalChartConfiguration } =
        handleChartConfiguration();
      const updatedDashboard =
        saveType === SAVE_TYPE_OVERWRITE_CONFIRMED
          ? data
          : {
              certified_by: cleanedData.certified_by,
              certification_details: cleanedData.certification_details,
              css: cleanedData.css,
              dashboard_title: cleanedData.dashboard_title,
              slug: cleanedData.slug,
              owners: cleanedData.owners,
              roles: cleanedData.roles,
              json_metadata: safeStringify({
                ...(cleanedData?.metadata || {}),
                default_filters: safeStringify(serializedFilters),
                filter_scopes: serializedFilterScopes,
                chart_configuration: chartConfiguration,
                global_chart_configuration: globalChartConfiguration,
              }),
            };

      const updateDashboard = () =>
        SupersetClient.put({
          endpoint: `/api/v1/dashboard/${id}`,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedDashboard),
        })
          .then(response => onUpdateSuccess(response))
          .catch(response => onError(response));
      return new Promise((resolve, reject) => {
        if (
          !isFeatureEnabled(FeatureFlag.ConfirmDashboardDiff) ||
          saveType === SAVE_TYPE_OVERWRITE_CONFIRMED
        ) {
          // skip overwrite precheck
          resolve();
          return;
        }

        // precheck for overwrite items
        SupersetClient.get({
          endpoint: `/api/v1/dashboard/${id}`,
        }).then(response => {
          const dashboard = response.json.result;
          const overwriteConfirmItems = getOverwriteItems(
            dashboard,
            updatedDashboard,
          );
          if (overwriteConfirmItems.length > 0) {
            dispatch(
              setOverrideConfirm({
                updatedAt: dashboard.changed_on,
                updatedBy: dashboard.changed_by_name,
                overwriteConfirmItems,
                dashboardId: id,
                data: updatedDashboard,
              }),
            );
            return reject(overwriteConfirmItems);
          }
          return resolve();
        });
      })
        .then(updateDashboard)
        .catch(overwriteConfirmItems => {
          const errorText = t('Please confirm the overwrite values.');
          dispatch(
            logEvent(LOG_ACTIONS_CONFIRM_OVERWRITE_DASHBOARD_METADATA, {
              dashboard_id: id,
              items: overwriteConfirmItems,
            }),
          );
          dispatch(addDangerToast(errorText));
        });
    }
    // changing the data as the endpoint requires
    if ('positions' in cleanedData && !('positions' in cleanedData.metadata)) {
      cleanedData.metadata.positions = cleanedData.positions;
    }
    cleanedData.metadata.default_filters = safeStringify(serializedFilters);
    cleanedData.metadata.filter_scopes = serializedFilterScopes;
    const copyPayload = {
      dashboard_title: cleanedData.dashboard_title,
      css: cleanedData.css,
      duplicate_slices: cleanedData.duplicate_slices,
      json_metadata: JSON.stringify(cleanedData.metadata),
    };

    return SupersetClient.post({
      endpoint: `/api/v1/dashboard/${id}/copy/`,
      jsonPayload: copyPayload,
    })
      .then(response => onCopySuccess(response))
      .catch(response => onError(response));
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

export const ON_FILTERS_REFRESH = 'ON_FILTERS_REFRESH';
export function onFiltersRefresh() {
  return { type: ON_FILTERS_REFRESH };
}

export const ON_FILTERS_REFRESH_SUCCESS = 'ON_FILTERS_REFRESH_SUCCESS';
export function onFiltersRefreshSuccess() {
  return { type: ON_FILTERS_REFRESH_SUCCESS };
}

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
    refreshCharts(chartList, force, interval, dashboardId, dispatch).then(
      () => {
        dispatch(onRefreshSuccess());
        dispatch(onFiltersRefresh());
      },
    );
  };
}

export const SHOW_BUILDER_PANE = 'SHOW_BUILDER_PANE';
export function showBuilderPane() {
  return { type: SHOW_BUILDER_PANE };
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
    const form_data = {
      ...selectedSlice.form_data,
      slice_id: selectedSlice.slice_id,
    };
    const newChart = {
      ...initChart,
      id,
      form_data: applyDefaultFormData(form_data),
    };

    return Promise.all([
      dispatch(addChart(newChart, id)),
      dispatch(fetchDatasourceMetadata(form_data.datasource)),
    ]).then(() => {
      dispatch(addSlice(selectedSlice));
    });
  };
}

export function removeSliceFromDashboard(id) {
  return dispatch => {
    dispatch(removeSlice(id));
    dispatch(removeChart(id));
    getLabelsColorMap().removeSlice(id);
  };
}

export const SET_COLOR_SCHEME = 'SET_COLOR_SCHEME';
export function setColorScheme(colorScheme) {
  return { type: SET_COLOR_SCHEME, colorScheme };
}

export const SET_DIRECT_PATH = 'SET_DIRECT_PATH';
export function setDirectPathToChild(path) {
  return { type: SET_DIRECT_PATH, path };
}

export const SET_ACTIVE_TAB = 'SET_ACTIVE_TAB';
export function setActiveTab(tabId, prevTabId) {
  return { type: SET_ACTIVE_TAB, tabId, prevTabId };
}

// Even though SET_ACTIVE_TABS is not being called from Superset's codebase,
// it is being used by Preset extensions.
export const SET_ACTIVE_TABS = 'SET_ACTIVE_TABS';
export function setActiveTabs(activeTabs) {
  return { type: SET_ACTIVE_TABS, activeTabs };
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
        t(
          'You have used all %(historyLength)s undo slots and will not be able to fully undo subsequent actions. You may save your current state to reset the history.',
          { historyLength },
        ),
      ),
    );
  };
}

export const SET_DATASETS_STATUS = 'SET_DATASETS_STATUS';
export function setDatasetsStatus(status) {
  return {
    type: SET_DATASETS_STATUS,
    status,
  };
}

const storeDashboardColorConfig = async (id, metadata) =>
  SupersetClient.put({
    endpoint: `/api/v1/dashboard/${id}/colors?mark_updated=false`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      color_namespace: metadata.color_namespace,
      color_scheme: metadata.color_scheme,
      color_scheme_domain: metadata.color_scheme_domain || [],
      shared_label_colors: metadata.shared_label_colors || [],
      map_label_colors: metadata.map_label_colors || {},
      label_colors: metadata.label_colors || {},
    }),
  });

/**
 *
 * Persists the label colors maps in the dashboard metadata.
 * It runs when outdated color info are detected in stored metadata.
 *
 * @returns void
 */
export const persistDashboardLabelsColor = () => async (dispatch, getState) => {
  const {
    dashboardInfo: { id, metadata },
    dashboardState: { labelsColorMapMustSync, sharedLabelsColorsMustSync },
  } = getState();

  if (labelsColorMapMustSync || sharedLabelsColorsMustSync) {
    dispatch(setDashboardLabelsColorMapSynced());
    dispatch(setDashboardSharedLabelsColorsSynced());
    storeDashboardColorConfig(id, metadata);
  }
};

/**
 * Checks the stored dashboard metadata for inconsistencies.
 * Update the current metadata with validated color information.
 * It runs only on Dashboard page load.
 *
 * @param {*} metadata - the stored dashboard metadata
 * @returns void
 */
export const applyDashboardLabelsColorOnLoad = metadata => async dispatch => {
  try {
    const customLabelsColor = metadata.label_colors || {};
    let hasChanged = false;

    // backward compatibility of shared_label_colors
    const sharedLabels = metadata.shared_label_colors || [];
    if (!Array.isArray(sharedLabels) && Object.keys(sharedLabels).length > 0) {
      hasChanged = true;
      dispatch(
        setDashboardMetadata({
          shared_label_colors: [],
        }),
      );
    }
    // backward compatibility of map_label_colors
    const hasMapLabelColors = !!metadata.map_label_colors;

    let updatedScheme = metadata.color_scheme;
    const categoricalSchemes = getCategoricalSchemeRegistry();
    const colorSchemeRegistry = categoricalSchemes.get(updatedScheme, true);
    const hasInvalidColorScheme = !!updatedScheme && !colorSchemeRegistry;

    // color scheme might not exist any longer
    if (hasInvalidColorScheme) {
      const defaultScheme = categoricalSchemes.defaultKey;
      const fallbackScheme = defaultScheme?.toString() || 'supersetColors';
      hasChanged = true;
      updatedScheme = fallbackScheme;

      dispatch(setColorScheme(updatedScheme));
      dispatch(
        setDashboardMetadata({
          color_scheme: updatedScheme,
        }),
      );
    }

    // the stored color domain registry and fresh might differ at this point
    const freshColorSchemeDomain = updatedScheme
      ? getColorSchemeDomain(updatedScheme)
      : [];
    const currentColorSchemeDomain = metadata.color_scheme_domain || [];

    if (!isEqual(freshColorSchemeDomain, currentColorSchemeDomain)) {
      hasChanged = true;
      dispatch(
        setDashboardMetadata({
          color_scheme_domain: freshColorSchemeDomain,
        }),
      );
    }

    // if color scheme is invalid or map is missing, apply a fresh color map
    // if valid, apply the stored map to keep consistency across refreshes
    const shouldGoFresh = !hasMapLabelColors || hasInvalidColorScheme;
    applyColors(metadata, shouldGoFresh);

    if (shouldGoFresh) {
      hasChanged = true;
      dispatch(
        setDashboardMetadata({
          map_label_colors: getFreshLabelsColorMapEntries(customLabelsColor),
        }),
      );
    }

    if (hasChanged) {
      dispatch(setDashboardLabelsColorMapSync());
    }
  } catch (e) {
    console.error('Failed to update dashboard color on load:', e);
  }
};

/**
 *
 * Ensure that the stored color map matches fresh map.
 *
 * @param {*} metadata - the dashboard metadata
 * @returns void
 */
export const ensureSyncedLabelsColorMap = metadata => (dispatch, getState) => {
  const syncLabelsColorMap = () => {
    const {
      dashboardState: { labelsColorMapMustSync },
    } = getState();
    const customLabelsColor = metadata.label_colors || {};
    const fullLabelsColors = getDynamicLabelsColors(
      metadata.map_label_colors || {},
      customLabelsColor,
    );
    const freshColorMapEntries =
      getFreshLabelsColorMapEntries(customLabelsColor);
    const isMapSynced = isLabelsColorMapSynced(
      fullLabelsColors,
      freshColorMapEntries,
      customLabelsColor,
    );

    if (!isMapSynced) {
      dispatch(
        setDashboardMetadata({
          map_label_colors: freshColorMapEntries,
        }),
      );
    }

    if (!isMapSynced && !labelsColorMapMustSync) {
      // prepare to persist the just applied labels color map
      dispatch(setDashboardLabelsColorMapSync());
    }
  };
  promiseTimeout(syncLabelsColorMap, 500);
};

/**
 *
 * Ensure that the stored shared labels colors match current.
 *
 * @param {*} metadata - the dashboard metadata
 * @param {*} forceFresh - when true it will use the fresh shared labels ignoring stored ones
 * @returns void
 */
export const ensureSyncedSharedLabelsColors =
  (metadata, forceFresh = false) =>
  (dispatch, getState) => {
    const syncSharedLabelsColors = () => {
      const {
        dashboardState: { sharedLabelsColorsMustSync },
      } = getState();
      const sharedLabelsColors = enforceSharedLabelsColorsArray(
        metadata.shared_label_colors,
      );
      const freshLabelsColors = getFreshSharedLabels(
        forceFresh ? [] : sharedLabelsColors,
      );
      const isSharedLabelsColorsSynced = isEqual(
        sharedLabelsColors.sort(),
        freshLabelsColors.sort(),
      );
      const mustSync = !isSharedLabelsColorsSynced;

      if (mustSync) {
        dispatch(
          setDashboardMetadata({
            shared_label_colors: freshLabelsColors,
          }),
        );
      }

      if (mustSync && !sharedLabelsColorsMustSync) {
        // prepare to persist the shared labels colors
        dispatch(setDashboardSharedLabelsColorsSync());
      }
    };
    promiseTimeout(syncSharedLabelsColors, 500);
  };

/**
 *
 * Updates the color map with new labels and colors as they appear.
 *
 * @param {*} renderedChartIds - the charts that have finished rendering
 * @returns void
 */
export const updateDashboardLabelsColor = renderedChartIds => (_, getState) => {
  try {
    const {
      dashboardInfo: { metadata },
      charts,
    } = getState();
    const colorScheme = metadata.color_scheme;
    const labelsColorMapInstance = getLabelsColorMap();
    const sharedLabelsColors = enforceSharedLabelsColorsArray(
      metadata.shared_label_colors,
    );
    const customLabelsColors = metadata.label_colors || {};
    const fullLabelsColors = getDynamicLabelsColors(
      metadata.map_label_colors || {},
      customLabelsColors,
    );

    // for dashboards with no color scheme, the charts should always use their individual schemes
    // this logic looks for unique labels (not shared across multiple charts) of each rendered chart
    // it applies a new color to those unique labels when the applied scheme is not up to date
    // while leaving shared label colors and custom label colors intact for color consistency
    const shouldReset = [];
    if (renderedChartIds.length > 0) {
      const sharedLabelsSet = new Set(sharedLabelsColors);
      renderedChartIds.forEach(id => {
        const chart = charts[id];
        const formData = chart.form_data || chart.latestQueryFormData;
        // ensure charts have their original color scheme always available
        labelsColorMapInstance.setOwnColorScheme(
          formData.slice_id,
          formData.color_scheme,
        );

        // if dashboard has a scheme, charts should ignore individual schemes
        // thus following logic is inapplicable if a dashboard color scheme exists
        if (colorScheme) return;

        const chartColorScheme = formData.color_scheme;
        const currentChartConfig = labelsColorMapInstance.chartsLabelsMap.get(
          formData.slice_id,
        );
        const currentChartLabels = currentChartConfig?.labels || [];
        const uniqueChartLabels = currentChartLabels.filter(
          l => !sharedLabelsSet.has(l) && !customLabelsColors.hasOwnProperty(l),
        );

        // Map unique labels to colors
        const uniqueChartLabelsColor = new Set(
          uniqueChartLabels.map(l => fullLabelsColors[l]).filter(Boolean),
        );

        const expectedColorsForChartScheme = new Set(
          getColorSchemeDomain(chartColorScheme),
        );

        // Check if any unique label color is not in the expected colors set
        const shouldResetColors = [...uniqueChartLabelsColor].some(
          color => !expectedColorsForChartScheme.has(color),
        );

        // Only push uniqueChartLabels if they require resetting
        if (shouldResetColors) shouldReset.push(...uniqueChartLabels);
      });
    }

    // an existing map is available, use mrge option
    // to only apply colors to newly found labels
    const shouldGoFresh = shouldReset.length > 0 ? shouldReset : false;
    const shouldMerge = !shouldGoFresh;
    // re-apply the color map first to get fresh maps accordingly
    applyColors(metadata, shouldGoFresh, shouldMerge);
  } catch (e) {
    console.error('Failed to update colors for new charts and labels:', e);
  }
};
