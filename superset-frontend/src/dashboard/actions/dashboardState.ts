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
import {
  useDashboardStateStore,
  useDashboardLayoutStore,
  useDashboardSlicesStore,
  useNativeFiltersStore,
  useDashboardInfoStore,
  type FilterEntry,
} from 'src/dashboard/stores';
// Direct submodule import, not the queries barrel, to avoid a cycle via useSaveDashboard.
import { getCachedSlice } from 'src/dashboard/queries/useSlicesQuery/useSlicesQuery';
import { queryClient } from 'src/queries/queryClient';
import { dashboardKeys } from 'src/dashboard/queries/keys';
import { rebaselineHydrationSnapshot } from 'src/dashboard/util/rebaselineHydrationDashboardInfo';
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
import { logging } from '@apache-superset/core/utils';
import { t } from '@apache-superset/core/translation';
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
import { isEqual } from 'lodash-es';
import { navigateWithState, navigateTo } from 'src/utils/navigationUtils';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import { persistChartConfiguration } from 'src/dashboard/queries/useSaveChartConfiguration/useSaveChartConfiguration';
import { fetchDatasourceMetadata, setDatasources } from './datasources';
import { updateDirectPathToFilter } from './dashboardFilters';
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

// Keep the slice in useDashboardSlicesStore so undo can re-add the chart.
export function removeSlice(sliceId: number): void {
  useDashboardStateStore.getState().removeSliceId(sliceId);
}

export function onSave(lastModifiedTime: number): void {
  useDashboardStateStore.getState().markSaved(lastModifiedTime);
}

export function saveDashboardRequestSuccess(lastModifiedTime: number): void {
  onSave(lastModifiedTime);
  useDashboardLayoutStore.temporal.getState().clear();
}

export function setDashboardLabelsColorMapSync(): void {
  useDashboardStateStore.getState().setLabelsColorMapMustSync(true);
}

export function setDashboardLabelsColorMapSynced(): void {
  useDashboardStateStore.getState().setLabelsColorMapMustSync(false);
}

export function setDashboardSharedLabelsColorsSync(): void {
  useDashboardStateStore.getState().setSharedLabelsColorsMustSync(true);
}

export function setDashboardSharedLabelsColorsSynced(): void {
  useDashboardStateStore.getState().setSharedLabelsColorsMustSync(false);
}

export const setDashboardMetadata =
  (updatedMetadata: JsonObject) => async (): Promise<void> => {
    const { dashboardInfo } = useDashboardInfoStore.getState();
    useDashboardInfoStore.getState().setDashboardInfo({
      metadata: {
        ...dashboardInfo?.metadata,
        ...updatedMetadata,
      },
    });
  };

// ---------------------------------------------------------------------------
// saveDashboardRequest
// ---------------------------------------------------------------------------

interface DashboardSaveData extends JsonObject {
  certified_by?: string;
  certification_details?: string;
  css?: string;
  dashboard_title?: string;
  editors?: { id: number }[] | number[];
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
    useDashboardStateStore.getState().setDashboardIsSaving(true);

    const { dashboardFilters } = getState();
    // Layout lives in the Zustand store — that's the source of truth.
    const { layout } = useDashboardLayoutStore.getState();
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
      editors,
      slug,
      description,
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
      ...(certified_by !== undefined && {
        certified_by,
        certification_details: certified_by
          ? (certification_details ?? '')
          : '',
      }),
      css: css || '',
      dashboard_title: dashboard_title || t('[ untitled dashboard ]'),
      editors: ensureIsArray(editors as JsonObject[]).map((o: JsonObject) =>
        hasId(o) ? o.id : o,
      ),
      slug: slug || null,
      description: description || null,
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
      const { charts } = getState();
      const { metadata } = useDashboardInfoStore.getState().dashboardInfo;
      return getCrossFiltersConfiguration(
        useDashboardLayoutStore.getState().layout,
        metadata,
        charts,
      );
    };

    const onCopySuccess = (response: JsonObject): JsonObject => {
      const lastModifiedTime = (response.json as JsonObject).result
        ?.last_modified_time as number;
      if (lastModifiedTime) {
        saveDashboardRequestSuccess(lastModifiedTime);
      }
      const { chartConfiguration, globalChartConfiguration } =
        handleChartConfiguration();
      persistChartConfiguration({
        chartConfiguration,
        globalChartConfiguration,
      }).catch(() =>
        dispatch(addDangerToast(t('Failed to save cross-filter scoping'))),
      );
      useDashboardStateStore.getState().setDashboardIsSaving(false);
      navigateTo(`/dashboard/${(response.json as JsonObject).result?.id}/`);
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
        if (parsedMetadata.native_filter_configuration) {
          useNativeFiltersStore
            .getState()
            .setInScopeStatus(
              parsedMetadata.native_filter_configuration as FilterEntry[],
            );
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
        saveDashboardRequestSuccess(lastModifiedTime);
      }
      useDashboardStateStore.getState().setDashboardIsSaving(false);
      // redirect to the new slug or id
      navigateWithState(`/dashboard/${slug || id}/`, {
        event: 'dashboard_properties_changed',
      });

      dispatch(addSuccessToast(t('This dashboard was saved successfully.')));
      useDashboardStateStore.getState().setOverwriteConfirmMetadata(undefined);
      // Rebaseline the discard snapshot to the saved state so later discards stay
      // in-place. Charts/dashboardFilters still live in Redux, so pass current values.
      queryClient.invalidateQueries({ queryKey: dashboardKeys.detail(id) });
      rebaselineHydrationSnapshot(id, {
        charts: getState().charts,
        dashboardFilters: getState().dashboardFilters,
      });
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
      useDashboardStateStore.getState().setDashboardIsSaving(false);
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
              description: cleanedData.description,
              editors: cleanedData.editors,
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
          .catch(async response => {
            // Rethrow after side effects so TanStack sees a rejection.
            await onError(response);
            throw response;
          });
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
            useDashboardStateStore.getState().setOverwriteConfirmMetadata({
              updatedAt: dashboard.changed_on as string,
              updatedBy: dashboard.changed_by_name as string,
              overwriteConfirmItems:
                overwriteConfirmItems as DashboardState['overwriteConfirmMetadata'] extends
                  { overwriteConfirmItems: infer I } | undefined
                  ? I
                  : never,
              dashboardId: id,
              data: updatedDashboard,
            });
            return reject(overwriteConfirmItems);
          }
          return resolve();
        });
      })
        .then(updateDashboard)
        .catch((reason: JsonObject[] | unknown) => {
          // Precheck rejects with an array of overwrite items; PUT failures
          // surface here too and must propagate so callers can detect them.
          if (!Array.isArray(reason)) {
            throw reason;
          }
          // Save deferred to the confirm modal; clear the saving overlay.
          useDashboardStateStore.getState().setDashboardIsSaving(false);
          dispatch(
            logEvent(LOG_ACTIONS_CONFIRM_OVERWRITE_DASHBOARD_METADATA, {
              dashboard_id: id,
              items: reason,
            }),
          );
          dispatch(addDangerToast(t('Please confirm the overwrite values.')));
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
): (dispatch: AppDispatch) => Promise<void> {
  return (dispatch: AppDispatch) => {
    if (!interval) {
      return Promise.all(
        chartList.map(chartKey =>
          Promise.resolve(dispatch(refreshChart(chartKey, force, dashboardId))),
        ),
      ).then(() => undefined);
    }

    const { metadata } = useDashboardInfoStore.getState().dashboardInfo;
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
      useDashboardStateStore.getState().setIsRefreshing(true);
      useDashboardStateStore.getState().recordRefreshTime();
      dispatch({ type: ON_REFRESH });
    }

    return refreshCharts(
      chartList,
      force,
      interval,
      dashboardId,
      dispatch,
    ).then(() => {
      useDashboardStateStore.getState().setIsRefreshing(false);
      if (!skipFiltersRefresh && !isLazyLoad) {
        useDashboardStateStore.getState().setIsFiltersRefreshing(true);
      }
    });
  };
}

// ---------------------------------------------------------------------------
// Slice management
// ---------------------------------------------------------------------------

export function addSliceToDashboard(
  id: number,
): (dispatch: AppDispatch) => Promise<void> | AnyAction {
  return (dispatch: AppDispatch) => {
    // Slices store first (hydrated charts), slices-query cache as fallback (panel adds).
    const selectedSlice =
      useDashboardSlicesStore.getState().slices[id] ?? getCachedSlice(id);
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
      // Commit slice metadata and id together on success, so a rejected add
      // can't leave slices and sliceIds out of sync.
      useDashboardSlicesStore.getState().addSlice(selectedSlice);
      useDashboardStateStore
        .getState()
        .addSliceId((selectedSlice as Slice).slice_id);
    });
  };
}

export function removeSliceFromDashboard(
  id: number,
): (dispatch: AppDispatch) => void {
  return (dispatch: AppDispatch) => {
    removeSlice(id);
    dispatch(removeChart(id));
    getLabelsColorMap().removeSlice(id);
  };
}

// ---------------------------------------------------------------------------
// Tab management
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Undo history
// ---------------------------------------------------------------------------

export function maxUndoHistoryToast(): (
  dispatch: AppDispatch,
  getState: GetState,
) => AnyAction {
  return (dispatch: AppDispatch) => {
    const historyLength =
      useDashboardLayoutStore.temporal.getState().pastStates.length;

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
export const persistDashboardLabelsColor = () => async (): Promise<void> => {
  const { id, metadata } = useDashboardInfoStore.getState().dashboardInfo;
  const { labelsColorMapMustSync, sharedLabelsColorsMustSync } =
    useDashboardStateStore.getState();

  if (labelsColorMapMustSync || sharedLabelsColorsMustSync) {
    setDashboardLabelsColorMapSynced();
    setDashboardSharedLabelsColorsSynced();
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

        useDashboardStateStore.getState().setColorScheme(updatedScheme);
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
        setDashboardLabelsColorMapSync();
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
  (dispatch: AppDispatch): void => {
    const syncLabelsColorMap = (): void => {
      const { labelsColorMapMustSync } = useDashboardStateStore.getState();
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
        setDashboardLabelsColorMapSync();
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
  (dispatch: AppDispatch): void => {
    const syncSharedLabelsColors = (): void => {
      const { sharedLabelsColorsMustSync } = useDashboardStateStore.getState();
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
        setDashboardSharedLabelsColorsSync();
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
      const { charts } = getState();
      const { metadata } = useDashboardInfoStore.getState().dashboardInfo;
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
