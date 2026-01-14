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
import { ensureIsArray, QueryFormData, JsonObject } from '@superset-ui/core';
import {
  ControlState,
  ControlStateMapping,
  Dataset,
} from '@superset-ui/chart-controls';
import { omit, pick } from 'lodash';
import { DYNAMIC_PLUGIN_CONTROLS_READY } from 'src/components/Chart/chartAction';
import { getControlsState } from 'src/explore/store';
import {
  getControlConfig,
  getControlStateFromControlConfig,
  getControlValuesCompatibleWithDatasource,
  StandardizedFormData,
} from 'src/explore/controlUtils';
import * as actions from 'src/explore/actions/exploreActions';
import { HYDRATE_EXPLORE, HydrateExplore } from '../actions/hydrateExplore';
import { Slice } from 'src/types/Chart';
import { SaveActionType } from 'src/explore/types';

// Type definitions for explore state
export interface ExploreState {
  can_add?: boolean;
  can_download?: boolean;
  can_overwrite?: boolean;
  isDatasourceMetaLoading?: boolean;
  isDatasourcesLoading?: boolean;
  isStarred?: boolean;
  triggerRender?: boolean;
  datasource?: Dataset;
  controls: ControlStateMapping;
  form_data: QueryFormData;
  hiddenFormData?: Partial<QueryFormData>;
  slice?: Slice | null;
  sliceName?: string;
  controlsTransferred?: string[];
  standalone?: boolean;
  force?: boolean;
  common?: JsonObject;
  metadata?: {
    owners?: string[] | null;
  };
  saveAction?: SaveActionType | null;
}

// Action type definitions
interface DynamicPluginControlsReadyAction {
  type: typeof DYNAMIC_PLUGIN_CONTROLS_READY;
  controlsState: ControlStateMapping;
}

interface ToggleFaveStarAction {
  type: typeof actions.TOGGLE_FAVE_STAR;
  isStarred: boolean;
}

interface PostDatasourceStartedAction {
  type: typeof actions.POST_DATASOURCE_STARTED;
}

interface StartMetadataLoadingAction {
  type: typeof actions.START_METADATA_LOADING;
}

interface StopMetadataLoadingAction {
  type: typeof actions.STOP_METADATA_LOADING;
}

interface SyncDatasourceMetadataAction {
  type: typeof actions.SYNC_DATASOURCE_METADATA;
  datasource: Dataset;
}

interface UpdateFormDataByDatasourceAction {
  type: typeof actions.UPDATE_FORM_DATA_BY_DATASOURCE;
  prevDatasource: Dataset;
  newDatasource: Dataset & { uid: string };
}

interface FetchDatasourcesStartedAction {
  type: typeof actions.FETCH_DATASOURCES_STARTED;
}

interface SetFieldValueAction {
  type: typeof actions.SET_FIELD_VALUE;
  controlName: string;
  value: unknown;
  validationErrors?: string[];
}

interface SetExploreControlsAction {
  type: typeof actions.SET_EXPLORE_CONTROLS;
  formData: QueryFormData;
}

interface SetFormDataAction {
  type: typeof actions.SET_FORM_DATA;
  formData: QueryFormData;
}

interface UpdateChartTitleAction {
  type: typeof actions.UPDATE_CHART_TITLE;
  sliceName: string;
}

interface SetSaveActionAction {
  type: typeof actions.SET_SAVE_ACTION;
  saveAction: SaveActionType | null;
}

interface CreateNewSliceAction {
  type: typeof actions.CREATE_NEW_SLICE;
  slice: Slice;
  form_data: QueryFormData;
  can_add: boolean;
  can_download: boolean;
  can_overwrite: boolean;
}

interface SetStashFormDataAction {
  type: typeof actions.SET_STASH_FORM_DATA;
  fieldNames: readonly string[];
  isHidden: boolean;
}

// Owner can be either a number (user ID) or an object with value/label
// This handles both Slice format (number[]) and select control format ({value, label}[])
type OwnerItem = number | { value: number; label: string };

interface SliceUpdatedAction {
  type: typeof actions.SLICE_UPDATED;
  slice: Omit<Slice, 'owners'> & {
    owners?: OwnerItem[];
    slice_name?: string;
  };
}

interface SetForceQueryAction {
  type: typeof actions.SET_FORCE_QUERY;
  force: boolean;
}

type ExploreAction =
  | DynamicPluginControlsReadyAction
  | ToggleFaveStarAction
  | PostDatasourceStartedAction
  | StartMetadataLoadingAction
  | StopMetadataLoadingAction
  | SyncDatasourceMetadataAction
  | UpdateFormDataByDatasourceAction
  | FetchDatasourcesStartedAction
  | SetFieldValueAction
  | SetExploreControlsAction
  | SetFormDataAction
  | UpdateChartTitleAction
  | SetSaveActionAction
  | CreateNewSliceAction
  | SetStashFormDataAction
  | SliceUpdatedAction
  | SetForceQueryAction
  | HydrateExplore;

// Extended control state for dynamic form controls - uses Record for flexibility
// since control configs vary significantly across different control types
interface ExtendedControlState {
  [key: string]: unknown;
  value?: unknown;
  valueKey?: string;
  savedMetrics?: unknown[];
  columns?: unknown[];
  options?: unknown[];
  default?: unknown;
  rerender?: string[];
  renderTrigger?: boolean;
  validationErrors?: string[];
  validationDependancies?: string[];
}

interface MetricItem {
  label?: string;
}

type ActionHandlers = {
  [key: string]: () => ExploreState;
};

export default function exploreReducer(
  state: ExploreState = { controls: {}, form_data: {} as QueryFormData },
  action: ExploreAction,
): ExploreState {
  const actionHandlers: ActionHandlers = {
    [DYNAMIC_PLUGIN_CONTROLS_READY]() {
      const typedAction = action as DynamicPluginControlsReadyAction;
      return {
        ...state,
        controls: typedAction.controlsState,
      };
    },
    [actions.TOGGLE_FAVE_STAR]() {
      const typedAction = action as ToggleFaveStarAction;
      return {
        ...state,
        isStarred: typedAction.isStarred,
      };
    },
    [actions.POST_DATASOURCE_STARTED]() {
      return {
        ...state,
        isDatasourceMetaLoading: true,
      };
    },
    [actions.START_METADATA_LOADING]() {
      return {
        ...state,
        isDatasourceMetaLoading: true,
      };
    },
    [actions.STOP_METADATA_LOADING]() {
      return {
        ...state,
        isDatasourceMetaLoading: false,
      };
    },
    [actions.SYNC_DATASOURCE_METADATA]() {
      const typedAction = action as SyncDatasourceMetadataAction;
      return {
        ...state,
        datasource: typedAction.datasource,
      };
    },
    [actions.UPDATE_FORM_DATA_BY_DATASOURCE]() {
      const typedAction = action as UpdateFormDataByDatasourceAction;
      const newFormData = { ...state.form_data } as QueryFormData & {
        [key: string]: unknown;
      };
      const { prevDatasource, newDatasource } = typedAction;
      const controls = { ...state.controls } as Record<
        string,
        ExtendedControlState
      >;
      const controlsTransferred: string[] = [];

      if (
        prevDatasource.id !== newDatasource.id ||
        prevDatasource.type !== newDatasource.type
      ) {
        newFormData.datasource = newDatasource.uid;
      }
      // reset control values for column/metric related controls
      Object.entries(controls).forEach(([controlName, controlState]) => {
        if (
          // for direct column select controls
          controlState.valueKey === 'column_name' ||
          // for all other controls
          'savedMetrics' in controlState ||
          'columns' in controlState ||
          ('options' in controlState && !Array.isArray(controlState.options))
        ) {
          newFormData[controlName] = getControlValuesCompatibleWithDatasource(
            newDatasource,
            controlState,
            controlState.value,
          );
          if (
            ensureIsArray(newFormData[controlName]).length > 0 &&
            newFormData[controlName] !== controls[controlName].default
          ) {
            controlsTransferred.push(controlName);
          }
        }
      });

      const newState = {
        ...state,
        controls,
        datasource: newDatasource,
      };
      return {
        ...newState,
        form_data: newFormData as QueryFormData,
        controls: getControlsState(
          newState,
          newFormData as QueryFormData,
        ) as ControlStateMapping,
        controlsTransferred,
      };
    },
    [actions.FETCH_DATASOURCES_STARTED]() {
      return {
        ...state,
        isDatasourcesLoading: true,
      };
    },
    [actions.SET_FIELD_VALUE]() {
      const typedAction = action as SetFieldValueAction;
      const { controlName, value, validationErrors } = typedAction;
      let new_form_data: QueryFormData & { [key: string]: unknown } = {
        ...state.form_data,
        [controlName]: value,
      };
      const old_metrics_data = (state.form_data as { metrics?: MetricItem[] })
        .metrics;
      const new_column_config = (
        state.form_data as { column_config?: Record<string, unknown> }
      ).column_config
        ? {
            ...(state.form_data as { column_config?: Record<string, unknown> })
              .column_config,
          }
        : undefined;

      const vizType = new_form_data.viz_type;

      // if the controlName is metrics, and the metric column name is updated,
      // need to update column config as well to keep the previous config.
      if (controlName === 'metrics' && old_metrics_data && new_column_config) {
        (value as MetricItem[]).forEach((item, index) => {
          const itemExist = old_metrics_data.some(
            oldItem => oldItem?.label === item?.label,
          );

          if (
            !itemExist &&
            item?.label !== old_metrics_data[index]?.label &&
            old_metrics_data[index]?.label &&
            new_column_config[old_metrics_data[index].label!]
          ) {
            new_column_config[item.label!] =
              new_column_config[old_metrics_data[index].label!];

            delete new_column_config[old_metrics_data[index].label!];
          }
        });
        new_form_data.column_config = new_column_config;
      }

      // Use the processed control config (with overrides and everything)
      // if `controlName` does not exist in current controls,
      const controlConfig =
        state.controls[controlName] ||
        getControlConfig(controlName, vizType) ||
        null;

      // will call validators again
      const control: ExtendedControlState = {
        ...getControlStateFromControlConfig(controlConfig, state, value),
      } as ExtendedControlState;

      const column_config = {
        ...state.controls.column_config,
        ...(new_column_config && { value: new_column_config }),
      };

      const newState = {
        ...state,
        controls: {
          ...state.controls,
          ...(controlConfig && { [controlName]: control }),
          ...(controlName === 'metrics' && { column_config }),
        },
      };

      const rerenderedControls: Record<string, ExtendedControlState> = {};
      if (Array.isArray(control.rerender)) {
        control.rerender.forEach((rerenderControlName: string) => {
          rerenderedControls[rerenderControlName] = {
            ...getControlStateFromControlConfig(
              newState.controls[rerenderControlName],
              newState,
              newState.controls[rerenderControlName].value,
            ),
          } as ExtendedControlState;
        });
      }

      // combine newly detected errors with errors from `onChange` event of
      // each control component (passed via reducer action).
      const errors: string[] = control.validationErrors || [];
      (validationErrors || []).forEach(err => {
        // skip duplicated errors
        if (!errors.includes(err)) {
          errors.push(err);
        }
      });
      const hasErrors = errors && errors.length > 0;

      const isVizSwitch =
        controlName === 'viz_type' && value !== state.controls.viz_type?.value;
      let currentControlsState = state.controls;
      if (isVizSwitch) {
        // get StandardizedFormData from source form_data
        const sfd = new StandardizedFormData(state.form_data);
        const transformed = sfd.transform(value as string, state);
        new_form_data = transformed.formData;
        currentControlsState = transformed.controlsState;
      }

      const controlsTyped = state.controls as Record<
        string,
        ExtendedControlState
      >;
      const dependantControls = Object.entries(controlsTyped)
        .filter(
          ([, item]) =>
            Array.isArray(item?.validationDependancies) &&
            item.validationDependancies.includes(controlName),
        )
        .map(([key, item]) => ({
          controlState: item,
          dependantControlName: key,
        }));

      let updatedControlStates: Record<string, ExtendedControlState> = {};
      if (dependantControls.length > 0) {
        const updatedControls = dependantControls.map(
          ({ controlState, dependantControlName }) => {
            // overwrite state form data with current control value as the redux state will not
            // have latest action value
            const overWrittenState = {
              ...state,
              form_data: {
                ...state.form_data,
                [controlName]: value,
              },
            };

            return {
              // Re run validation for dependent controls
              controlState: getControlStateFromControlConfig(
                controlState,
                overWrittenState,
                controlState?.value,
              ),
              dependantControlName,
            };
          },
        );

        updatedControlStates = updatedControls.reduce(
          (
            acc: Record<string, ExtendedControlState>,
            { controlState, dependantControlName },
          ) => {
            acc[dependantControlName] = {
              ...controlState,
            } as ExtendedControlState;
            return acc;
          },
          {},
        );
      }

      return {
        ...state,
        form_data: new_form_data as QueryFormData,
        triggerRender: control.renderTrigger && !hasErrors,
        controls: {
          ...currentControlsState,
          ...(controlConfig && {
            [controlName]: {
              ...control,
              validationErrors: errors,
            },
          }),
          ...rerenderedControls,
          ...updatedControlStates,
        },
      };
    },
    [actions.SET_EXPLORE_CONTROLS]() {
      const typedAction = action as SetExploreControlsAction;
      return {
        ...state,
        controls: getControlsState(
          state,
          typedAction.formData,
        ) as ControlStateMapping,
      };
    },
    [actions.SET_FORM_DATA]() {
      const typedAction = action as SetFormDataAction;
      return {
        ...state,
        form_data: typedAction.formData,
      };
    },
    [actions.UPDATE_CHART_TITLE]() {
      const typedAction = action as UpdateChartTitleAction;
      return {
        ...state,
        sliceName: typedAction.sliceName,
      };
    },
    [actions.SET_SAVE_ACTION]() {
      const typedAction = action as SetSaveActionAction;
      return {
        ...state,
        saveAction: typedAction.saveAction,
      };
    },
    [actions.CREATE_NEW_SLICE]() {
      const typedAction = action as CreateNewSliceAction;
      return {
        ...state,
        slice: typedAction.slice,
        controls: getControlsState(
          state,
          typedAction.form_data,
        ) as ControlStateMapping,
        can_add: typedAction.can_add,
        can_download: typedAction.can_download,
        can_overwrite: typedAction.can_overwrite,
      };
    },
    [actions.SET_STASH_FORM_DATA]() {
      const typedAction = action as SetStashFormDataAction;
      const { form_data, hiddenFormData } = state;
      const { fieldNames, isHidden } = typedAction;
      if (isHidden) {
        return {
          ...state,
          hiddenFormData: {
            ...hiddenFormData,
            ...pick(form_data, fieldNames as string[]),
          },
          form_data: omit(form_data, fieldNames as string[]) as QueryFormData,
        };
      }

      const restoredField = pick(
        hiddenFormData,
        fieldNames as string[],
      ) as Partial<QueryFormData>;
      return Object.keys(restoredField).length === 0
        ? state
        : {
            ...state,
            form_data: {
              ...form_data,
              ...restoredField,
            } as QueryFormData,
            hiddenFormData: omit(
              hiddenFormData,
              fieldNames as string[],
            ) as Partial<QueryFormData>,
          };
    },
    [actions.SLICE_UPDATED]() {
      const typedAction = action as SliceUpdatedAction;
      // Handle owners that can be either number[] or Array<{value, label}>
      const getOwnerId = (owner: OwnerItem): number =>
        typeof owner === 'number' ? owner : owner.value;
      const getOwnerLabel = (owner: OwnerItem): string | null =>
        typeof owner === 'number' ? null : owner.label;
      return {
        ...state,
        slice: {
          ...state.slice,
          ...typedAction.slice,
          owners: typedAction.slice.owners
            ? typedAction.slice.owners.map(getOwnerId)
            : null,
        } as Slice,
        sliceName: typedAction.slice.slice_name ?? state.sliceName,
        metadata: {
          ...state.metadata,
          owners: typedAction.slice.owners
            ? typedAction.slice.owners.map(getOwnerLabel).filter(Boolean)
            : null,
        },
      };
    },
    [actions.SET_FORCE_QUERY]() {
      const typedAction = action as SetForceQueryAction;
      return {
        ...state,
        force: typedAction.force,
      };
    },
    [HYDRATE_EXPLORE]() {
      const typedAction = action as HydrateExplore;
      return {
        ...typedAction.data.explore,
      };
    },
  };
  if (action.type in actionHandlers) {
    return actionHandlers[action.type]();
  }
  return state;
}
