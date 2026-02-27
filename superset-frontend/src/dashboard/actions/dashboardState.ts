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
  getClientErrorObject,
  getCategoricalSchemeRegistry,
  promiseTimeout,
  JsonObject,
} from '@superset-ui/core';
import {
  addChart,
  removeChart,
  refreshChart,
} from 'src/components/Chart/chartAction';
import { logging } from '@apache-superset/core';
import { t } from '@apache-superset/core/ui';
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
import { navigateWithState, navigateTo } from 'src/utils/navigationUtils';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import type { AgGridChartState } from '@superset-ui/core';
import type { DashboardChartStates } from 'src/dashboard/types/chartState';
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
import type { DashboardState, GetState, RootState, Slice } from '../types';

// Dashboard dispatch type. The base ThunkDispatch handles dashboard-specific
// thunks. The intersection with a generic function-accepting overload allows
// dispatching thunks from other modules (e.g. chart actions) whose RootState
// type differs from the dashboard RootState. At runtime the Redux store
// satisfies all module state shapes.
interface AppDispatch extends ThunkDispatch<RootState, undefined, AnyAction> {
  <R>(asyncAction: (...args: never[]) => R): R;
}

// ---------------------------------------------------------------------------
// Simple action creators
// ---------------------------------------------------------------------------

export const TOGGLE_NATIVE_FILTERS_BAR = 'TOGGLE_NATIVE_FILTERS_BAR';

interface ToggleNativeFiltersBarAction {
  type: typeof TOGGLE_NATIVE_FILTERS_BAR;
  isOpen: boolean;
}

export function toggleNativeFiltersBar(
  isOpen: boolean,
): ToggleNativeFiltersBarAction {
  return { type: TOGGLE_NATIVE_FILTERS_BAR, isOpen };
}

export const SET_UNSAVED_CHANGES = 'SET_UNSAVED_CHANGES';

interface SetUnsavedChangesAction {
  type: typeof SET_UNSAVED_CHANGES;
  payload: { hasUnsavedChanges: boolean };
}

export function setUnsavedChanges(
  hasUnsavedChanges: boolean,
): SetUnsavedChangesAction {
  return { type: SET_UNSAVED_CHANGES, payload: { hasUnsavedChanges } };
}

export const ADD_SLICE = 'ADD_SLICE';

interface AddSliceAction {
  type: typeof ADD_SLICE;
  slice: Slice;
}

export function addSlice(slice: Slice): AddSliceAction {
  return { type: ADD_SLICE, slice };
}

export const REMOVE_SLICE = 'REMOVE_SLICE';

interface RemoveSliceAction {
  type: typeof REMOVE_SLICE;
  sliceId: number;
}

export function removeSlice(sliceId: number): RemoveSliceAction {
  return { type: REMOVE_SLICE, sliceId };
}

export const TOGGLE_FAVE_STAR = 'TOGGLE_FAVE_STAR';

interface ToggleFaveStarAction {
  type: typeof TOGGLE_FAVE_STAR;
  isStarred: boolean;
}

export function toggleFaveStar(isStarred: boolean): ToggleFaveStarAction {
  return { type: TOGGLE_FAVE_STAR, isStarred };
}

export function fetchFaveStar(id: number) {
  return function fetchFaveStarThunk(dispatch: AppDispatch) {
    return SupersetClient.get({
      endpoint: `/api/v1/dashboard/favorite_status/?q=${rison.encode([id])}`,
    })
      .then(({ json }: { json: JsonObject }) => {
        dispatch(toggleFaveStar(!!(json?.result as JsonObject[])?.[0]?.value));
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

export function saveFaveStar(id: number, isStarred: boolean) {
  return function saveFaveStarThunk(dispatch: AppDispatch) {
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

interface TogglePublishedAction {
  type: typeof TOGGLE_PUBLISHED;
  isPublished: boolean;
}

export function togglePublished(isPublished: boolean): TogglePublishedAction {
  return { type: TOGGLE_PUBLISHED, isPublished };
}

export function savePublished(
  id: number,
  isPublished: boolean,
): (dispatch: AppDispatch) => Promise<void> {
  return function savePublishedThunk(dispatch: AppDispatch): Promise<void> {
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

interface ToggleExpandSliceAction {
  type: typeof TOGGLE_EXPAND_SLICE;
  sliceId: number;
}

export function toggleExpandSlice(sliceId: number): ToggleExpandSliceAction {
  return { type: TOGGLE_EXPAND_SLICE, sliceId };
}

export const SET_EDIT_MODE = 'SET_EDIT_MODE';

interface SetEditModeAction {
  type: typeof SET_EDIT_MODE;
  editMode: boolean;
}

export function setEditMode(editMode: boolean): SetEditModeAction {
  return { type: SET_EDIT_MODE, editMode };
}

export const ON_CHANGE = 'ON_CHANGE';

interface OnChangeAction {
  type: typeof ON_CHANGE;
}

export function onChange(): OnChangeAction {
  return { type: ON_CHANGE };
}

export const ON_SAVE = 'ON_SAVE';

interface OnSaveAction {
  type: typeof ON_SAVE;
  lastModifiedTime: number;
}

export function onSave(lastModifiedTime: number): OnSaveAction {
  return { type: ON_SAVE, lastModifiedTime };
}

export const SET_REFRESH_FREQUENCY = 'SET_REFRESH_FREQUENCY';

interface SetRefreshFrequencyAction {
  type: typeof SET_REFRESH_FREQUENCY;
  refreshFrequency: number;
  isPersistent: boolean;
}

export function setRefreshFrequency(
  refreshFrequency: number,
  isPersistent = false,
): SetRefreshFrequencyAction {
  return { type: SET_REFRESH_FREQUENCY, refreshFrequency, isPersistent };
}

export function saveDashboardRequestSuccess(
  lastModifiedTime: number,
): (dispatch: AppDispatch) => void {
  return (dispatch: AppDispatch) => {
    dispatch(onSave(lastModifiedTime));
    // clear layout undo history
    dispatch(UndoActionCreators.clearHistory());
  };
}

export const SET_OVERRIDE_CONFIRM = 'SET_OVERRIDE_CONFIRM';

interface SetOverrideConfirmAction {
  type: typeof SET_OVERRIDE_CONFIRM;
  overwriteConfirmMetadata: DashboardState['overwriteConfirmMetadata'];
}

export function setOverrideConfirm(
  overwriteConfirmMetadata: DashboardState['overwriteConfirmMetadata'],
): SetOverrideConfirmAction {
  return {
    type: SET_OVERRIDE_CONFIRM,
    overwriteConfirmMetadata,
  };
}

export const SAVE_DASHBOARD_STARTED = 'SAVE_DASHBOARD_STARTED';

interface SaveDashboardStartedAction {
  type: typeof SAVE_DASHBOARD_STARTED;
}

export function saveDashboardStarted(): SaveDashboardStartedAction {
  return { type: SAVE_DASHBOARD_STARTED };
}

export const SAVE_DASHBOARD_FINISHED = 'SAVE_DASHBOARD_FINISHED';

interface SaveDashboardFinishedAction {
  type: typeof SAVE_DASHBOARD_FINISHED;
}

export function saveDashboardFinished(): SaveDashboardFinishedAction {
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

interface SetDashboardLabelsColorMapSyncAction {
  type: typeof SET_DASHBOARD_LABELS_COLORMAP_SYNCABLE;
}

interface SetDashboardLabelsColorMapSyncedAction {
  type: typeof SET_DASHBOARD_LABELS_COLORMAP_SYNCED;
}

interface SetDashboardSharedLabelsColorsSyncAction {
  type: typeof SET_DASHBOARD_SHARED_LABELS_COLORS_SYNCABLE;
}

interface SetDashboardSharedLabelsColorsSyncedAction {
  type: typeof SET_DASHBOARD_SHARED_LABELS_COLORS_SYNCED;
}

export function setDashboardLabelsColorMapSync(): SetDashboardLabelsColorMapSyncAction {
  return { type: SET_DASHBOARD_LABELS_COLORMAP_SYNCABLE };
}

export function setDashboardLabelsColorMapSynced(): SetDashboardLabelsColorMapSyncedAction {
  return { type: SET_DASHBOARD_LABELS_COLORMAP_SYNCED };
}

export function setDashboardSharedLabelsColorsSync(): SetDashboardSharedLabelsColorsSyncAction {
  return { type: SET_DASHBOARD_SHARED_LABELS_COLORS_SYNCABLE };
}

export function setDashboardSharedLabelsColorsSynced(): SetDashboardSharedLabelsColorsSyncedAction {
  return { type: SET_DASHBOARD_SHARED_LABELS_COLORS_SYNCED };
}

export const setDashboardMetadata =
  (updatedMetadata: JsonObject) =>
  async (dispatch: AppDispatch, getState: GetState): Promise<void> => {
    const { dashboardInfo } = getState();
    dispatch(
      dashboardInfoChanged({
        metadata: {
          ...dashboardInfo?.metadata,
          ...updatedMetadata,
        },
      }),
    );
  };

// ---------------------------------------------------------------------------
// saveDashboardRequest
// ---------------------------------------------------------------------------

interface DashboardSaveData extends JsonObject {
  certified_by?: string;
  certification_details?: string;
  css?: string;
  dashboard_title?: string;
  owners?: { id: number }[] | number[];
  roles?: JsonObject[];
  slug?: string | null;
  tags?: JsonObject[];
  metadata?: JsonObject;
  positions?: JsonObject;
  duplicate_slices?: boolean;
  theme_id?: number | null;
}

export function saveDashboardRequest(
  data: DashboardSaveData,
  id: number,
  saveType: string,
): (dispatch: AppDispatch, getState: GetState) => Promise<JsonObject | void> {
  return (dispatch: AppDispatch, getState: GetState) => {
    dispatch({ type: UPDATE_COMPONENTS_PARENTS_LIST });
    dispatch(saveDashboardStarted());

    const { dashboardFilters, dashboardLayout } = getState();
    const layout = dashboardLayout.present;
    Object.values(dashboardFilters).forEach((filter: JsonObject) => {
      const { chartId } = filter;
      const componentId = (filter.directPathToFilter as string[])
        .slice()
        .pop() as string;
      const directPathToFilter = (layout[componentId]?.parents || []).slice();
      directPathToFilter.push(componentId);
      dispatch(updateDirectPathToFilter(chartId as number, directPathToFilter));
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
      tags,
    } = data;

    const hasId = (item: JsonObject): boolean => item.id !== undefined;
    const metadataCrossFiltersEnabled = data.metadata?.cross_filters_enabled;
    const colorScheme = data.metadata?.color_scheme as string | undefined;
    const customLabelsColor = (data.metadata?.label_colors || {}) as Record<
      string,
      string
    >;
    const sharedLabelsColor = enforceSharedLabelsColorsArray(
      data.metadata?.shared_label_colors,
    );
    const cleanedData: JsonObject = {
      ...data,
      certified_by: certified_by || '',
      certification_details:
        certified_by && certification_details ? certification_details : '',
      css: css || '',
      dashboard_title: dashboard_title || t('[ untitled dashboard ]'),
      owners: ensureIsArray(owners as JsonObject[]).map((o: JsonObject) =>
        hasId(o) ? o.id : o,
      ),
      roles: !isFeatureEnabled(FeatureFlag.DashboardRbac)
        ? undefined
        : ensureIsArray(roles as JsonObject[]).map((r: JsonObject) =>
            hasId(r) ? r.id : r,
          ),
      slug: slug || null,
      tags: !isFeatureEnabled(FeatureFlag.TaggingSystem)
        ? undefined
        : ensureIsArray((tags || []) as JsonObject[]).map((r: JsonObject) =>
            hasId(r) ? r.id : r,
          ),
      metadata: {
        ...data.metadata,
        color_namespace: getColorNamespace(
          data.metadata?.color_namespace as string | undefined,
        ),
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
          metadataCrossFiltersEnabled as boolean | undefined,
        ),
      },
    };

    const handleChartConfiguration = () => {
      const {
        dashboardLayout: currentDashboardLayout,
        charts,
        dashboardInfo: { metadata },
      } = getState();
      return getCrossFiltersConfiguration(
        currentDashboardLayout.present,
        metadata,
        charts,
      );
    };

    const onCopySuccess = (response: JsonObject): JsonObject => {
      const lastModifiedTime = (response.json as JsonObject).result
        ?.last_modified_time as number;
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
      navigateTo(
        `/superset/dashboard/${(response.json as JsonObject).result?.id}/`,
      );
      dispatch(addSuccessToast(t('This dashboard was saved successfully.')));
      return response;
    };

    const onUpdateSuccess = (response: JsonObject): JsonObject => {
      const updatedDashboard = (response.json as JsonObject)
        .result as JsonObject;
      const lastModifiedTime = (response.json as JsonObject)
        .last_modified_time as number;
      // syncing with the backend transformations of the metadata
      if (updatedDashboard.json_metadata) {
        const parsedMetadata: JsonObject = JSON.parse(
          updatedDashboard.json_metadata as string,
        );
        dispatch(setDashboardMetadata(parsedMetadata));
        if (parsedMetadata.chart_configuration) {
          dispatch({
            type: SAVE_CHART_CONFIG_COMPLETE,
            chartConfiguration: parsedMetadata.chart_configuration,
          });
        }
        if (parsedMetadata.native_filter_configuration) {
          dispatch({
            type: SET_IN_SCOPE_STATUS_OF_FILTERS,
            filterConfig: parsedMetadata.native_filter_configuration,
          });
        }

        // fetch datasets to make sure they are up to date
        SupersetClient.get({
          endpoint: `/api/v1/dashboard/${id}/datasets`,
          headers: { 'Content-Type': 'application/json' },
        })
          .then(({ json }: { json: JsonObject }) => {
            const datasources = json?.result ?? [];
            if ((datasources as JsonObject[]).length) {
              dispatch(
                setDatasources(
                  datasources as Parameters<typeof setDatasources>[0],
                ),
              );
            }
          })
          .catch((error: Error) => {
            logging.error('Error fetching dashboard datasets:', error);
          });
      }
      if (lastModifiedTime) {
        dispatch(saveDashboardRequestSuccess(lastModifiedTime));
      }
      dispatch(saveDashboardFinished());
      // redirect to the new slug or id
      navigateWithState(`/superset/dashboard/${slug || id}/`, {
        event: 'dashboard_properties_changed',
      });

      dispatch(addSuccessToast(t('This dashboard was saved successfully.')));
      dispatch(setOverrideConfirm(undefined));
      return response;
    };

    const onError = async (response: Response): Promise<void> => {
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
      const updatedDashboard: JsonObject =
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
              tags: cleanedData.tags || [],
              theme_id: cleanedData.theme_id,
              json_metadata: safeStringify({
                ...(cleanedData?.metadata as JsonObject),
                default_filters: safeStringify(serializedFilters),
                filter_scopes: serializedFilterScopes,
                chart_configuration: chartConfiguration,
                global_chart_configuration: globalChartConfiguration,
              }),
            };

      const updateDashboard = (): Promise<JsonObject | void> =>
        SupersetClient.put({
          endpoint: `/api/v1/dashboard/${id}`,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedDashboard),
        })
          .then(response => onUpdateSuccess(response))
          .catch(response => onError(response));
      return new Promise<void>((resolve, reject) => {
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
        }).then((response: JsonObject) => {
          const dashboard = (response.json as JsonObject).result as JsonObject;
          const overwriteConfirmItems = getOverwriteItems(
            dashboard,
            updatedDashboard,
          );
          if (overwriteConfirmItems.length > 0) {
            dispatch(
              setOverrideConfirm({
                updatedAt: dashboard.changed_on as string,
                updatedBy: dashboard.changed_by_name as string,
                overwriteConfirmItems:
                  overwriteConfirmItems as DashboardState['overwriteConfirmMetadata'] extends
                    | { overwriteConfirmItems: infer I }
                    | undefined
                    ? I
                    : never,
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
        .catch((overwriteConfirmItems: JsonObject[]) => {
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
    if (
      'positions' in cleanedData &&
      !('positions' in (cleanedData.metadata as JsonObject))
    ) {
      (cleanedData.metadata as JsonObject).positions = cleanedData.positions;
    }
    (cleanedData.metadata as JsonObject).default_filters =
      safeStringify(serializedFilters);
    (cleanedData.metadata as JsonObject).filter_scopes = serializedFilterScopes;
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

// ---------------------------------------------------------------------------
// Chart refresh
// ---------------------------------------------------------------------------

export function fetchCharts(
  chartList: number[] = [],
  force = false,
  interval = 0,
  dashboardId?: number,
): (dispatch: AppDispatch, getState: GetState) => Promise<void> {
  return (dispatch: AppDispatch, getState: GetState) => {
    if (!interval) {
      return Promise.all(
        chartList.map(chartKey =>
          Promise.resolve(dispatch(refreshChart(chartKey, force, dashboardId))),
        ),
      ).then(() => undefined);
    }

    const { metadata } = getState().dashboardInfo;
    const meta = metadata as JsonObject;
    const refreshTime = Math.max(
      interval,
      (meta.stagger_time as number) || 5000,
    ); // default 5 seconds
    // Normalize stagger_refresh to boolean without mutating state
    let staggerRefresh: boolean;
    if (typeof meta.stagger_refresh === 'boolean') {
      staggerRefresh = meta.stagger_refresh;
    } else {
      staggerRefresh =
        meta.stagger_refresh === undefined
          ? true
          : meta.stagger_refresh === 'true';
    }
    // Only stagger when there are multiple charts to avoid division by zero
    const delay =
      staggerRefresh && chartList.length > 1
        ? refreshTime / (chartList.length - 1)
        : 0;
    return Promise.all(
      chartList.map(
        (chartKey: number, i: number) =>
          new Promise<void>((resolve, reject) => {
            setTimeout(() => {
              Promise.resolve(
                dispatch(refreshChart(chartKey, force, dashboardId)),
              )
                .then(() => resolve())
                .catch(reject);
            }, delay * i);
          }),
      ),
    ).then(() => undefined);
  };
}

const refreshCharts = (
  chartList: number[],
  force: boolean,
  interval: number,
  dashboardId: number | undefined,
  dispatch: AppDispatch,
): Promise<void> =>
  dispatch(fetchCharts(chartList, force, interval, dashboardId));

export const ON_FILTERS_REFRESH = 'ON_FILTERS_REFRESH';

interface OnFiltersRefreshAction {
  type: typeof ON_FILTERS_REFRESH;
}

export function onFiltersRefresh(): OnFiltersRefreshAction {
  return { type: ON_FILTERS_REFRESH };
}

export const ON_FILTERS_REFRESH_SUCCESS = 'ON_FILTERS_REFRESH_SUCCESS';

interface OnFiltersRefreshSuccessAction {
  type: typeof ON_FILTERS_REFRESH_SUCCESS;
}

export function onFiltersRefreshSuccess(): OnFiltersRefreshSuccessAction {
  return { type: ON_FILTERS_REFRESH_SUCCESS };
}

export const ON_REFRESH_SUCCESS = 'ON_REFRESH_SUCCESS';

interface OnRefreshSuccessAction {
  type: typeof ON_REFRESH_SUCCESS;
}

export function onRefreshSuccess(): OnRefreshSuccessAction {
  return { type: ON_REFRESH_SUCCESS };
}

export const ON_REFRESH = 'ON_REFRESH';

export function onRefresh(
  chartList: number[] = [],
  force = false,
  interval = 0,
  dashboardId?: number,
  skipFiltersRefresh = false,
  isLazyLoad = false,
): (dispatch: AppDispatch) => Promise<void> {
  return (dispatch: AppDispatch) => {
    // Only dispatch ON_REFRESH for dashboard-level refreshes
    // Skip it for lazy-loaded tabs to prevent infinite loops
    if (!isLazyLoad) {
      dispatch({ type: ON_REFRESH });
    }

    return refreshCharts(
      chartList,
      force,
      interval,
      dashboardId,
      dispatch,
    ).then(() => {
      dispatch(onRefreshSuccess());
      if (!skipFiltersRefresh && !isLazyLoad) {
        dispatch(onFiltersRefresh());
      }
    });
  };
}

export const SHOW_BUILDER_PANE = 'SHOW_BUILDER_PANE';

interface ShowBuilderPaneAction {
  type: typeof SHOW_BUILDER_PANE;
}

export function showBuilderPane(): ShowBuilderPaneAction {
  return { type: SHOW_BUILDER_PANE };
}

// ---------------------------------------------------------------------------
// Slice management
// ---------------------------------------------------------------------------

export function addSliceToDashboard(
  id: number,
): (dispatch: AppDispatch, getState: GetState) => Promise<void> | AnyAction {
  return (dispatch: AppDispatch, getState: GetState) => {
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
    } as JsonObject;
    const newChart = {
      ...initChart,
      id,
      form_data: applyDefaultFormData(
        form_data as Parameters<typeof applyDefaultFormData>[0],
      ),
    };

    return Promise.all([
      dispatch(addChart(newChart, id)),
      dispatch(fetchDatasourceMetadata(form_data.datasource as string)),
    ]).then(() => {
      dispatch(addSlice(selectedSlice as Slice));
    });
  };
}

export function removeSliceFromDashboard(
  id: number,
): (dispatch: AppDispatch) => void {
  return (dispatch: AppDispatch) => {
    dispatch(removeSlice(id));
    dispatch(removeChart(id));
    getLabelsColorMap().removeSlice(id);
  };
}

export const SET_COLOR_SCHEME = 'SET_COLOR_SCHEME';

interface SetColorSchemeAction {
  type: typeof SET_COLOR_SCHEME;
  colorScheme: string;
}

export function setColorScheme(colorScheme: string): SetColorSchemeAction {
  return { type: SET_COLOR_SCHEME, colorScheme };
}

export const SET_DIRECT_PATH = 'SET_DIRECT_PATH';

interface SetDirectPathAction {
  type: typeof SET_DIRECT_PATH;
  path: string[];
}

export function setDirectPathToChild(path: string[]): SetDirectPathAction {
  return { type: SET_DIRECT_PATH, path };
}

// ---------------------------------------------------------------------------
// Tab management
// ---------------------------------------------------------------------------

export const SET_ACTIVE_TAB = 'SET_ACTIVE_TAB';

interface FindTabsToRestoreResult {
  activeTabs: string[];
  inactiveTabs: string[];
}

function findTabsToRestore(
  tabId: string,
  prevTabId: string | undefined,
  dashboardState: DashboardState,
  dashboardLayout: RootState['dashboardLayout'],
): FindTabsToRestoreResult {
  const { activeTabs: prevActiveTabs, inactiveTabs: prevInactiveTabs } =
    dashboardState;
  const { present: currentLayout } = dashboardLayout;
  const restoredTabs: string[] = [];
  const queue: string[] = [tabId];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const seek = queue.shift()!;
    if (!visited.has(seek)) {
      visited.add(seek);
      const found =
        prevInactiveTabs?.filter(inactiveTabId =>
          (currentLayout[inactiveTabId]?.parents ?? [])
            .filter((parentId: string) => parentId.startsWith('TAB-'))
            .slice(-1)
            .includes(seek),
        ) ?? [];
      restoredTabs.push(...found);
      queue.push(...found);
    }
  }
  const activeTabs =
    restoredTabs.length > 0 ? [tabId].concat(restoredTabs) : [tabId];
  const tabChanged = Boolean(prevTabId) && tabId !== prevTabId;
  const inactiveTabs = tabChanged
    ? (prevActiveTabs || []).filter(
        (activeTabId: string) =>
          activeTabId !== prevTabId &&
          (currentLayout[activeTabId]?.parents ?? []).includes(prevTabId!),
      )
    : [];
  return {
    activeTabs,
    inactiveTabs,
  };
}

interface SetActiveTabAction {
  type: typeof SET_ACTIVE_TAB;
  activeTabs: string[];
  prevTabId: string | undefined;
  inactiveTabs: string[];
}

export function setActiveTab(
  tabId: string,
  prevTabId?: string,
): (dispatch: AppDispatch, getState: GetState) => SetActiveTabAction {
  return (dispatch: AppDispatch, getState: GetState) => {
    const { dashboardLayout, dashboardState } = getState();
    const { activeTabs, inactiveTabs } = findTabsToRestore(
      tabId,
      prevTabId,
      dashboardState,
      dashboardLayout,
    );

    return dispatch({
      type: SET_ACTIVE_TAB,
      activeTabs,
      prevTabId,
      inactiveTabs,
    } as SetActiveTabAction);
  };
}

// Even though SET_ACTIVE_TABS is not being called from Superset's codebase,
// it is being used by Preset extensions.
export const SET_ACTIVE_TABS = 'SET_ACTIVE_TABS';

interface SetActiveTabsAction {
  type: typeof SET_ACTIVE_TABS;
  activeTabs: string[];
}

export function setActiveTabs(activeTabs: string[]): SetActiveTabsAction {
  return { type: SET_ACTIVE_TABS, activeTabs };
}

// ---------------------------------------------------------------------------
// Filter focus
// ---------------------------------------------------------------------------

export const SET_FOCUSED_FILTER_FIELD = 'SET_FOCUSED_FILTER_FIELD';

interface SetFocusedFilterFieldAction {
  type: typeof SET_FOCUSED_FILTER_FIELD;
  chartId: number;
  column: string;
}

export function setFocusedFilterField(
  chartId: number,
  column: string,
): SetFocusedFilterFieldAction {
  return { type: SET_FOCUSED_FILTER_FIELD, chartId, column };
}

export const UNSET_FOCUSED_FILTER_FIELD = 'UNSET_FOCUSED_FILTER_FIELD';

interface UnsetFocusedFilterFieldAction {
  type: typeof UNSET_FOCUSED_FILTER_FIELD;
  chartId: number;
  column: string;
}

export function unsetFocusedFilterField(
  chartId: number,
  column: string,
): UnsetFocusedFilterFieldAction {
  return { type: UNSET_FOCUSED_FILTER_FIELD, chartId, column };
}

// ---------------------------------------------------------------------------
// Full-size chart
// ---------------------------------------------------------------------------

export const SET_FULL_SIZE_CHART_ID = 'SET_FULL_SIZE_CHART_ID';

interface SetFullSizeChartIdAction {
  type: typeof SET_FULL_SIZE_CHART_ID;
  chartId: number | null;
}

export function setFullSizeChartId(
  chartId: number | null,
): SetFullSizeChartIdAction {
  return { type: SET_FULL_SIZE_CHART_ID, chartId };
}

// ---------------------------------------------------------------------------
// Chart state (AG Grid persistence, etc.)
// ---------------------------------------------------------------------------

export const UPDATE_CHART_STATE = 'UPDATE_CHART_STATE';

interface UpdateChartStateAction {
  type: typeof UPDATE_CHART_STATE;
  chartId: number;
  vizType: string;
  chartState: AgGridChartState;
  lastModified: number;
}

export function updateChartState(
  chartId: number,
  vizType: string,
  chartState: AgGridChartState,
): UpdateChartStateAction {
  return {
    type: UPDATE_CHART_STATE,
    chartId,
    vizType,
    chartState,
    lastModified: Date.now(),
  };
}

export const REMOVE_CHART_STATE = 'REMOVE_CHART_STATE';

interface RemoveChartStateAction {
  type: typeof REMOVE_CHART_STATE;
  chartId: number;
}

export function removeChartState(chartId: number): RemoveChartStateAction {
  return { type: REMOVE_CHART_STATE, chartId };
}

export const RESTORE_CHART_STATES = 'RESTORE_CHART_STATES';

interface RestoreChartStatesAction {
  type: typeof RESTORE_CHART_STATES;
  chartStates: DashboardChartStates;
}

export function restoreChartStates(
  chartStates: DashboardChartStates,
): RestoreChartStatesAction {
  return { type: RESTORE_CHART_STATES, chartStates };
}

export const CLEAR_ALL_CHART_STATES = 'CLEAR_ALL_CHART_STATES';

interface ClearAllChartStatesAction {
  type: typeof CLEAR_ALL_CHART_STATES;
}

export function clearAllChartStates(): ClearAllChartStatesAction {
  return { type: CLEAR_ALL_CHART_STATES };
}

// ---------------------------------------------------------------------------
// Undo history
// ---------------------------------------------------------------------------

export const SET_MAX_UNDO_HISTORY_EXCEEDED = 'SET_MAX_UNDO_HISTORY_EXCEEDED';

interface SetMaxUndoHistoryExceededAction {
  type: typeof SET_MAX_UNDO_HISTORY_EXCEEDED;
  payload: { maxUndoHistoryExceeded: boolean };
}

export function setMaxUndoHistoryExceeded(
  maxUndoHistoryExceeded = true,
): SetMaxUndoHistoryExceededAction {
  return {
    type: SET_MAX_UNDO_HISTORY_EXCEEDED,
    payload: { maxUndoHistoryExceeded },
  };
}

export function maxUndoHistoryToast(): (
  dispatch: AppDispatch,
  getState: GetState,
) => AnyAction {
  return (dispatch: AppDispatch, getState: GetState) => {
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

// ---------------------------------------------------------------------------
// Datasets status
// ---------------------------------------------------------------------------

export const SET_DATASETS_STATUS = 'SET_DATASETS_STATUS';

interface SetDatasetsStatusAction {
  type: typeof SET_DATASETS_STATUS;
  status: ResourceStatus;
}

export function setDatasetsStatus(
  status: ResourceStatus,
): SetDatasetsStatusAction {
  return {
    type: SET_DATASETS_STATUS,
    status,
  };
}

// ---------------------------------------------------------------------------
// Color persistence
// ---------------------------------------------------------------------------

const storeDashboardColorConfig = async (
  id: number,
  metadata: JsonObject,
): Promise<JsonObject> =>
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
export const persistDashboardLabelsColor =
  () =>
  async (dispatch: AppDispatch, getState: GetState): Promise<void> => {
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
 * @param metadata - the stored dashboard metadata
 * @returns void
 */
export const applyDashboardLabelsColorOnLoad =
  (metadata: JsonObject) =>
  async (dispatch: AppDispatch): Promise<void> => {
    try {
      const customLabelsColor = (metadata.label_colors || {}) as Record<
        string,
        string
      >;
      let hasChanged = false;

      // backward compatibility of shared_label_colors
      const sharedLabels = metadata.shared_label_colors || [];
      if (
        !Array.isArray(sharedLabels) &&
        Object.keys(sharedLabels as Record<string, unknown>).length > 0
      ) {
        hasChanged = true;
        dispatch(
          setDashboardMetadata({
            shared_label_colors: [],
          }),
        );
      }
      // backward compatibility of map_label_colors
      const hasMapLabelColors = !!metadata.map_label_colors;

      let updatedScheme = metadata.color_scheme as string | undefined;
      const categoricalSchemes = getCategoricalSchemeRegistry();
      const colorSchemeRegistry = categoricalSchemes.get(
        updatedScheme as string,
        true,
      );
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
      const currentColorSchemeDomain =
        (metadata.color_scheme_domain as string[]) || [];

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
      logging.error('Failed to update dashboard color on load:', e);
    }
  };

/**
 *
 * Ensure that the stored color map matches fresh map.
 *
 * @param metadata - the dashboard metadata
 * @returns void
 */
export const ensureSyncedLabelsColorMap =
  (metadata: JsonObject) =>
  (dispatch: AppDispatch, getState: GetState): void => {
    const syncLabelsColorMap = (): void => {
      const {
        dashboardState: { labelsColorMapMustSync },
      } = getState();
      const customLabelsColor = (metadata.label_colors || {}) as Record<
        string,
        string
      >;
      const fullLabelsColors = getDynamicLabelsColors(
        (metadata.map_label_colors || {}) as Record<string, string>,
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
 * @param metadata - the dashboard metadata
 * @param forceFresh - when true it will use the fresh shared labels ignoring stored ones
 * @returns void
 */
export const ensureSyncedSharedLabelsColors =
  (metadata: JsonObject, forceFresh = false) =>
  (dispatch: AppDispatch, getState: GetState): void => {
    const syncSharedLabelsColors = (): void => {
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
 * @param renderedChartIds - the charts that have finished rendering
 * @returns void
 */
export const updateDashboardLabelsColor =
  (renderedChartIds: number[]) =>
  (_: AppDispatch, getState: GetState): void => {
    try {
      const {
        dashboardInfo: { metadata },
        charts,
      } = getState();
      const colorScheme = metadata.color_scheme as string | undefined;
      const labelsColorMapInstance = getLabelsColorMap();
      const sharedLabelsColors = enforceSharedLabelsColorsArray(
        metadata.shared_label_colors,
      );
      const customLabelsColors = (metadata.label_colors || {}) as Record<
        string,
        string
      >;
      const fullLabelsColors = getDynamicLabelsColors(
        (metadata.map_label_colors || {}) as Record<string, string>,
        customLabelsColors,
      );

      // for dashboards with no color scheme, the charts should always use their individual schemes
      // this logic looks for unique labels (not shared across multiple charts) of each rendered chart
      // it applies a new color to those unique labels when the applied scheme is not up to date
      // while leaving shared label colors and custom label colors intact for color consistency
      const shouldReset: string[] = [];
      if (renderedChartIds.length > 0) {
        const sharedLabelsSet = new Set(sharedLabelsColors);
        renderedChartIds.forEach((chartId: number) => {
          const chartObj = charts[chartId];
          const formData =
            (chartObj?.form_data as JsonObject) ||
            (chartObj?.latestQueryFormData as JsonObject);
          // ensure charts have their original color scheme always available
          labelsColorMapInstance.setOwnColorScheme(
            formData.slice_id as number,
            formData.color_scheme as string,
          );

          // if dashboard has a scheme, charts should ignore individual schemes
          // thus following logic is inapplicable if a dashboard color scheme exists
          if (colorScheme) return;

          const chartColorScheme = formData.color_scheme as string;
          const currentChartConfig = labelsColorMapInstance.chartsLabelsMap.get(
            formData.slice_id as number,
          );
          const currentChartLabels =
            ((currentChartConfig as JsonObject)?.labels as string[]) || [];
          const uniqueChartLabels = currentChartLabels.filter(
            (l: string) =>
              !sharedLabelsSet.has(l) &&
              !Object.prototype.hasOwnProperty.call(customLabelsColors, l),
          );

          // Map unique labels to colors
          const uniqueChartLabelsColor = new Set(
            uniqueChartLabels
              .map((l: string) => fullLabelsColors[l])
              .filter(Boolean),
          );

          const expectedColorsForChartScheme = new Set(
            getColorSchemeDomain(chartColorScheme),
          );

          // Check if any unique label color is not in the expected colors set
          const shouldResetColors = [...uniqueChartLabelsColor].some(
            (color: string) => !expectedColorsForChartScheme.has(color),
          );

          // Only push uniqueChartLabels if they require resetting
          if (shouldResetColors) shouldReset.push(...uniqueChartLabels);
        });
      }

      // an existing map is available, use merge option
      // to only apply colors to newly found labels
      const shouldGoFresh = shouldReset.length > 0 ? shouldReset : false;
      const shouldMerge = !shouldGoFresh;
      // re-apply the color map first to get fresh maps accordingly
      applyColors(metadata, shouldGoFresh, shouldMerge);
    } catch (e) {
      logging.error('Failed to update colors for new charts and labels:', e);
    }
  };
