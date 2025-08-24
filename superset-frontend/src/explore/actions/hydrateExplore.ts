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
import {
  Currency,
  ensureIsArray,
  getCategoricalSchemeRegistry,
  getColumnLabel,
  getSequentialSchemeRegistry,
  NO_TIME_RANGE,
  QueryFormColumn,
  VizType,
} from '@superset-ui/core';
import {
  getFormDataFromControls,
  applyMapStateToPropsToControl,
} from 'src/explore/controlUtils';
import { getDatasourceUid } from 'src/utils/getDatasourceUid';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';
import { findPermission } from 'src/utils/findPermission';

enum ColorSchemeType {
  CATEGORICAL = 'CATEGORICAL',
  SEQUENTIAL = 'SEQUENTIAL',
}

export const HYDRATE_EXPLORE = 'HYDRATE_EXPLORE';
export const hydrateExplore =
  ({
    form_data,
    slice,
    dataset,
    metadata,
    saveAction = null,
  }: ExplorePageInitialData) =>
  (dispatch: Dispatch, getState: () => ExplorePageState) => {
    const { user, datasources, charts, sliceEntities, common, explore } =
      getState();

    const sliceId = getUrlParam(URL_PARAMS.sliceId);
    const dashboardId = getUrlParam(URL_PARAMS.dashboardId);
    const fallbackSlice = sliceId ? sliceEntities?.slices?.[sliceId] : null;
    const initialSlice = slice ?? fallbackSlice;
    const initialFormData = form_data ?? initialSlice?.form_data;
    if (!initialFormData.viz_type) {
      const defaultVizType = common?.conf.DEFAULT_VIZ_TYPE || VizType.Table;
      initialFormData.viz_type =
        getUrlParam(URL_PARAMS.vizType) || defaultVizType;
    }
    if (!initialFormData.time_range) {
      initialFormData.time_range =
        common?.conf?.DEFAULT_TIME_FILTER || NO_TIME_RANGE;
    }
    if (
      initialFormData.include_time &&
      initialFormData.granularity_sqla &&
      !initialFormData.groupby?.some(
        (col: QueryFormColumn) =>
          getColumnLabel(col) ===
          getColumnLabel(initialFormData.granularity_sqla!),
      )
    ) {
      initialFormData.groupby = [
        initialFormData.granularity_sqla,
        ...ensureIsArray(initialFormData.groupby),
      ];
      initialFormData.granularity_sqla = undefined;
    }

    if (dashboardId) {
      initialFormData.dashboardId = dashboardId;
    }

    const initialDatasource = dataset;
    initialDatasource.currency_formats = Object.fromEntries(
      (initialDatasource.metrics ?? [])
        .filter(metric => !!metric.currency)
        .map((metric): [string, Currency] => [
          metric.metric_name,
          metric.currency!,
        ]),
    );

    const initialExploreState = {
      form_data: initialFormData,
      slice: initialSlice,
      datasource: initialDatasource,
    };
    const initialControls = getControlsState(
      initialExploreState,
      initialFormData,
    ) as ControlStateMapping;
    const colorSchemeKey = initialControls.color_scheme && 'color_scheme';
    const linearColorSchemeKey =
      initialControls.linear_color_scheme && 'linear_color_scheme';
    // if the selected color scheme does not exist anymore
    // fallbacks and selects the available default one
    const verifyColorScheme = (type: ColorSchemeType) => {
      const schemes =
        type === 'CATEGORICAL'
          ? getCategoricalSchemeRegistry()
          : getSequentialSchemeRegistry();
      const key =
        type === 'CATEGORICAL' ? colorSchemeKey : linearColorSchemeKey;
      const registryDefaultScheme = schemes.defaultKey;
      const defaultScheme =
        type === 'CATEGORICAL' ? 'supersetColors' : 'superset_seq_1';
      const currentScheme = initialFormData[key];
      const colorSchemeExists = !!schemes.get(currentScheme, true);

      if (currentScheme && !colorSchemeExists) {
        initialControls[key].value = registryDefaultScheme || defaultScheme;
      }
    };

    if (colorSchemeKey) verifyColorScheme(ColorSchemeType.CATEGORICAL);
    if (linearColorSchemeKey) verifyColorScheme(ColorSchemeType.SEQUENTIAL);

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
      controlsTransferred: explore.controlsTransferred,
      standalone: getUrlParam(URL_PARAMS.standalone),
      force: getUrlParam(URL_PARAMS.force),
      metadata,
      saveAction,
      common,
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
          isVisible: false,
        },
        explore: exploreState,
      },
    });
  };

export type HydrateExplore = {
  type: typeof HYDRATE_EXPLORE;
  data: ExplorePageState;
};

export const HYDRATE_PORTABLE_EXPLORE = 'HYDRATE_PORTABLE_EXPLORE';
export const hydratePortableExplore =
  ({
    form_data,
    dataset,
    vizType,
    dashboardId = null,
    metadata = null,
    slice = {},
  }: {
    form_data?: any;
    dataset: any;
    vizType: string;
    dashboardId?: number | null;
    metadata?: any;
    slice: any;
  }) =>
  (dispatch: Dispatch, getState: () => ExplorePageState) => {
    const { user, datasources, charts, common, explore, sliceEntities } =
      getState();

    // Handle existing slice data like hydrateExplore does
    const sliceId = form_data?.slice_id;
    const fallbackSlice =
      sliceId && sliceId !== 0 ? sliceEntities?.slices?.[sliceId] : null;
    const initialSlice = slice ?? fallbackSlice;

    const baseFormData = form_data ?? initialSlice?.form_data ?? {};

    // Create initial form data for portable explore
    const initialFormData = {
      ...baseFormData,
      slice_id: sliceId || 0, // Use existing slice_id or 0 for new chart
      viz_type: vizType || baseFormData.viz_type,
      datasource: baseFormData.datasource || `${dataset.id}__table`,
      time_range:
        baseFormData.time_range ||
        common?.conf?.DEFAULT_TIME_FILTER ||
        NO_TIME_RANGE,
      ...(dashboardId && { dashboardId }),
    };

    // Apply default viz_type if not provided (like hydrateExplore)
    if (!initialFormData.viz_type) {
      const defaultVizType = common?.conf.DEFAULT_VIZ_TYPE || VizType.Table;
      initialFormData.viz_type = defaultVizType;
    }

    // Ensure we have a time range
    if (!initialFormData.time_range) {
      initialFormData.time_range =
        common?.conf?.DEFAULT_TIME_FILTER || NO_TIME_RANGE;
    }

    // Handle include_time and granularity_sqla logic (like hydrateExplore)
    if (
      initialFormData.include_time &&
      initialFormData.granularity_sqla &&
      !initialFormData.groupby?.some(
        (col: QueryFormColumn) =>
          getColumnLabel(col) ===
          getColumnLabel(initialFormData.granularity_sqla!),
      )
    ) {
      initialFormData.groupby = [
        initialFormData.granularity_sqla,
        ...ensureIsArray(initialFormData.groupby),
      ];
      initialFormData.granularity_sqla = undefined;
    }

    if (dashboardId) {
      initialFormData.dashboardId = dashboardId;
    }

    // Set up datasource with currency formats
    const initialDatasource = { ...dataset };
    initialDatasource.currency_formats = Object.fromEntries(
      (initialDatasource.metrics ?? [])
        .filter((metric: any) => !!metric.currency)
        .map((metric: any): [string, Currency] => [
          metric.metric_name,
          metric.currency!,
        ]),
    );

    // Create initial explore state for control generation
    const initialExploreState = {
      form_data: initialFormData,
      slice: null, // No slice for new chart
      datasource: initialDatasource,
    };

    // Generate controls state
    const initialControls = getControlsState(
      initialExploreState,
      initialFormData,
    ) as ControlStateMapping;

    // Handle color schemes
    const colorSchemeKey = initialControls.color_scheme && 'color_scheme';
    const linearColorSchemeKey =
      initialControls.linear_color_scheme && 'linear_color_scheme';

    const verifyColorScheme = (type: ColorSchemeType) => {
      const schemes =
        type === 'CATEGORICAL'
          ? getCategoricalSchemeRegistry()
          : getSequentialSchemeRegistry();
      const key =
        type === 'CATEGORICAL' ? colorSchemeKey : linearColorSchemeKey;
      const registryDefaultScheme = schemes.defaultKey;
      const defaultScheme =
        type === 'CATEGORICAL' ? 'supersetColors' : 'superset_seq_1';
      const currentScheme = initialFormData[key];
      const colorSchemeExists = !!schemes.get(currentScheme, true);

      if (currentScheme && !colorSchemeExists) {
        initialControls[key].value = registryDefaultScheme || defaultScheme;
      }
    };

    if (colorSchemeKey) verifyColorScheme(ColorSchemeType.CATEGORICAL);
    if (linearColorSchemeKey) verifyColorScheme(ColorSchemeType.SEQUENTIAL);

    // Create slice object - use existing slice if available, otherwise create minimal one
    const portableSlice = initialSlice
      ? {
          ...initialSlice,
          form_data: initialFormData,
        }
      : {
          slice_id: 0,
          slice_name: 'New Chart',
          form_data: initialFormData,
          edit_url: null,
          slice_url: null,
          owners: [],
        };

    // Helper function to determine if user can overwrite the chart
    const canOverwriteChart = (
      initialSlice: any,
      formData: any,
      portableSlice: any,
      user: any,
    ): boolean => {
      // For new charts (slice_id = 0), user can always overwrite since they're creating it
      if (!initialSlice || formData.slice_id === 0) {
        return true;
      }

      // For existing charts, check if user is owner
      const owners = ensureIsArray(portableSlice?.owners || []);
      return owners.some((owner: any) => {
        if (typeof owner === 'number') {
          return owner === user?.userId;
        }
        if (typeof owner === 'object' && owner.value) {
          return owner.value === user?.userId;
        }
        return false;
      });
    };

    // Build explore state for portable explore
    const exploreState = {
      can_add: findPermission('can_write', 'Chart', user?.roles),
      can_download: findPermission('can_csv', 'Superset', user?.roles),
      can_overwrite: canOverwriteChart(
        initialSlice,
        initialFormData,
        portableSlice,
        user,
      ),
      isDatasourceMetaLoading: false,
      isStarred: false,
      triggerRender: false,
      datasource: initialDatasource,
      controls: initialControls,
      form_data: initialFormData,
      slice: portableSlice, // Provide a minimal slice object for new chart
      controlsTransferred: explore.controlsTransferred,
      standalone: false, // Within dashboard context
      force: false,
      metadata,
      saveAction: null,
      common,
      isPortableExplore: true, // Flag to indicate this is from portable explore
    };

    // Apply mapStateToProps for all controls
    Object.entries(exploreState.controls).forEach(([key, controlState]) => {
      exploreState.controls[key] = applyMapStateToPropsToControl(
        controlState,
        exploreState,
      );
    });

    // Use chartKey 0 for new/unsaved portable chart, or existing ID for editing
    const chartKey = initialFormData.slice_id || 0;
    const isEditingExisting = chartKey !== 0;

    const chart: ChartState = {
      id: chartKey,
      chartAlert: null,
      chartStatus: null,
      chartStackTrace: null,
      chartUpdateEndTime: null,
      chartUpdateStartTime: 0,
      latestQueryFormData: getFormDataFromControls(exploreState.controls),
      sliceFormData: isEditingExisting
        ? getFormDataFromControls(exploreState.controls)
        : null,
      queryController: null,
      queriesResponse: null,
      triggerQuery: false,
      lastRendered: 0,
    };

    return dispatch({
      type: HYDRATE_PORTABLE_EXPLORE,
      data: {
        charts: isEditingExisting
          ? charts // Don't overwrite existing chart, keep current state
          : {
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
          isVisible: false,
        },
        explore: exploreState,
      },
    });
  };

export type HydratePortableExplore = {
  type: typeof HYDRATE_PORTABLE_EXPLORE;
  data: ExplorePageState;
};
