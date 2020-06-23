/* eslint-disable camelcase */
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
import React, { ReactNode, ReactText, ReactElement } from 'react';
import { QueryFormData } from '@superset-ui/query';
import sharedControls from './shared-controls';
import sharedControlComponents from './shared-controls/components';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDict = Record<string, any>;
interface Action {
  type: string;
}
interface AnyAction extends Action, AnyDict {}

export type SharedControls = typeof sharedControls;
export type SharedControlAlias = keyof typeof sharedControls;
export type SharedControlComponents = typeof sharedControlComponents;

/** ----------------------------------------------
 * Input data/props while rendering
 * ---------------------------------------------*/
export interface ColumnMeta extends AnyDict {
  column_name: string;
  groupby?: string;
  verbose_name?: string;
  description?: string;
  expression?: string;
  is_dttm?: boolean;
  type?: string;
  filterable?: boolean;
}

export interface DatasourceMeta {
  columns: ColumnMeta[];
  metrics: unknown[];
  type: unknown;
  main_dttm_col: unknown;
  time_grain_sqla: unknown;
  order_by_choices?: [] | null;
}

export interface ControlPanelState {
  form_data: QueryFormData;
  datasource: DatasourceMeta | null;
  controls: ControlStateMapping;
}

/**
 * The action dispather will call Redux `dispatch` internally and return what's
 * returned from `dispatch`, which by default is the original or another action.
 */
export interface ActionDispatcher<ARGS extends unknown[], A extends Action = AnyAction> {
  (...args: ARGS): A;
}

/**
 * Mapping of action dispatchers
 */
export interface ControlPanelActionDispatchers {
  setDatasource: ActionDispatcher<[DatasourceMeta]>;
}

/**
 * Additional control props obtained from `mapStateToProps`.
 */
export type ExtraControlProps = AnyDict;

// Ref:superset-frontend/src/explore/store.js
export type ControlState<T = ControlType, O extends SelectOption = SelectOption> = ControlConfig<
  T,
  O
> &
  ExtraControlProps;

export interface ControlStateMapping {
  [key: string]: ControlState;
}

// Ref: superset-frontend/src/explore/components/ControlPanelsContainer.jsx
export interface ControlPanelsContainerProps extends AnyDict {
  actions: ControlPanelActionDispatchers;
  controls: ControlStateMapping;
  exportState: AnyDict;
  form_data: QueryFormData;
}

/** ----------------------------------------------
 * Config for a chart Control
 * ---------------------------------------------*/

// Ref: superset-frontend/src/explore/components/controls/index.js
export type InternalControlType =
  | 'AnnotationLayerControl'
  | 'BoundsControl'
  | 'CheckboxControl'
  | 'CollectionControl'
  | 'ColorMapControl'
  | 'ColorPickerControl'
  | 'ColorSchemeControl'
  | 'DatasourceControl'
  | 'DateFilterControl'
  | 'FixedOrMetricControl'
  | 'HiddenControl'
  | 'SelectAsyncControl'
  | 'SelectControl'
  | 'SliderControl'
  | 'SpatialControl'
  | 'TextAreaControl'
  | 'TextControl'
  | 'TimeSeriesColumnControl'
  | 'ViewportControl'
  | 'VizTypeControl'
  | 'MetricsControl'
  | 'AdhocFilterControl'
  | 'FilterBoxItemControl'
  | 'MetricsControlVerifiedOptions'
  | 'SelectControlVerifiedOptions'
  | 'AdhocFilterControlVerifiedOptions'
  | keyof SharedControlComponents; // expanded in `expandControlConfig`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ControlType = InternalControlType | React.ComponentType<any>;

export type TabOverride = 'data' | boolean;

/**
 * Control config specifying how chart controls appear in the control panel, all
 * these configs will be passed to the UI component for control as props.
 *
 * - type: the control type, referencing a React component of the same name
 * - label: the label as shown in the control's header
 * - description: shown in the info tooltip of the control's header
 * - default: the default value when opening a new chart, or changing visualization type
 * - renderTrigger: a bool that defines whether the visualization should be re-rendered
 *    when changed. This should `true` for controls that only affect the rendering (client side)
 *    and don't affect the query or backend data processing as those require to re run a query
 *    and fetch the data
 * - validators: an array of functions that will receive the value of the component and
 *    should return error messages when the value is not valid. The error message gets
 *    bubbled up to the control header, section header and query panel header.
 * - warning: text shown as a tooltip on a warning icon in the control's header
 * - error: text shown as a tooltip on a error icon in the control's header
 * - mapStateToProps: a function that receives the App's state and return an object of k/v
 *    to overwrite configuration at runtime. This is useful to alter a component based on
 *    anything external to it, like another control's value. For instance it's possible to
 *    show a warning based on the value of another component. It's also possible to bind
 *    arbitrary data from the redux store to the component this way.
 * - tabOverride: set to 'data' if you want to force a renderTrigger to show up on the `Data`
 *    tab, otherwise `renderTrigger: true` components will show up on the `Style` tab.
 * - visibility: a function that uses control panel props to check whether a control should
 *    be visibile.
 */
export interface BaseControlConfig<
  T extends ControlType = ControlType,
  O extends SelectOption = SelectOption,
  V = unknown
> extends AnyDict {
  type: T;
  label?: ReactNode;
  description?: ReactNode;
  default?: V;
  renderTrigger?: boolean;
  validators?: ControlValueValidator<T, O, V>[];
  warning?: ReactNode;
  error?: ReactNode;
  // override control panel state props
  mapStateToProps?: (
    state: ControlPanelState,
    control: this,
    actions?: ControlPanelActionDispatchers,
  ) => ExtraControlProps;
  tabOverride?: TabOverride;
  visibility?: (props: ControlPanelsContainerProps) => boolean;
}

export interface ControlValueValidator<
  T = ControlType,
  O extends SelectOption = SelectOption,
  V = unknown
> {
  (value: V, state: ControlState<T, O>): boolean | string;
}

/** --------------------------------------------
 * Additional Config for specific control Types
 * --------------------------------------------- */
type SelectOption = AnyDict | string | [ReactText, ReactNode];
type SelectControlType =
  | 'SelectControl'
  | 'SelectAsyncControl'
  | 'SelectControl'
  | 'MetricsControl'
  | 'FixedOrMetricControl'
  | 'AdhocFilterControl'
  | 'FilterBoxItemControl'
  | 'MetricsControlVerifiedOptions'
  | 'SelectControlVerifiedOptions'
  | 'AdhocFilterControlVerifiedOptions';

// via react-select/src/filters
interface FilterOption<T extends SelectOption> {
  label: string;
  value: string;
  data: T;
}

// Ref: superset-frontend/src/components/Select/SupersetStyledSelect.tsx
export interface SelectControlConfig<
  O extends SelectOption = SelectOption,
  T extends SelectControlType = SelectControlType
> extends BaseControlConfig<T, O> {
  clearable?: boolean;
  freeForm?: boolean;
  multi?: boolean;
  valueKey?: string;
  labelKey?: string;
  options?: O[];
  optionRenderer?: (option: O) => ReactNode;
  valueRenderer?: (option: O) => ReactNode;
  filterOption?: ((option: FilterOption<O>, rawInput: string) => Boolean) | null;
}

export type SharedControlConfig<
  T extends InternalControlType = InternalControlType,
  O extends SelectOption = SelectOption
> = T extends SelectControlType ? SelectControlConfig<O, T> : BaseControlConfig<T>;

/** --------------------------------------------
 * Custom controls
 * --------------------------------------------- */
export type CustomControlConfig<P = {}> = BaseControlConfig<React.ComponentType<P>> &
  // two run-time properties from superset-frontend/src/explore/components/Control.jsx
  Omit<P, 'onChange' | 'hovered'>;

// Catch-all ControlConfig
//  - if T is known control types, return SharedControlConfig,
//  - if T is object, assume a CustomComponent
//  - otherwise assume it's a custom component control
export type ControlConfig<
  T = AnyDict,
  O extends SelectOption = SelectOption
> = T extends InternalControlType
  ? SharedControlConfig<T, O>
  : T extends object
  ? CustomControlConfig<T> // eslint-disable-next-line @typescript-eslint/no-explicit-any
  : CustomControlConfig<any>;

/** ===========================================================
 * Chart plugin control panel config
 * ========================================================= */
export type SharedSectionAlias =
  | 'annotations'
  | 'colorScheme'
  | 'datasourceAndVizType'
  | 'druidTimeSeries'
  | 'sqlaTimeSeries'
  | 'NVD3TimeSeries';

export interface OverrideSharedControlItem<A extends SharedControlAlias = SharedControlAlias> {
  name: A;
  override: Partial<SharedControls[A]>;
}

export type CustomControlItem = {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: BaseControlConfig<any, any, any>;
};

// use ReactElement instead of ReactNode because `string`, `number`, etc. may
// interfere with other ControlSetItem types
export type ExpandedControlItem = CustomControlItem | ReactElement | null;

export type ControlSetItem = SharedControlAlias | OverrideSharedControlItem | ExpandedControlItem;

export type ControlSetRow = ControlSetItem[];

// Ref:
//  - superset-frontend/src/explore/components/ControlPanelsContainer.jsx
//  - superset-frontend/src/explore/components/ControlPanelSection.jsx
export interface ControlPanelSectionConfig {
  label: ReactNode;
  description?: ReactNode;
  expanded?: boolean;
  tabOverride?: TabOverride;
  controlSetRows: ControlSetRow[];
}

export interface ControlPanelConfig {
  controlPanelSections: ControlPanelSectionConfig[];
  controlOverrides?: ControlOverrides;
  sectionOverrides?: SectionOverrides;
  onInit?: (state: ControlStateMapping) => void;
}

export type ControlOverrides = {
  [P in SharedControlAlias]?: Partial<SharedControls[P]>;
};

export type SectionOverrides = {
  [P in SharedSectionAlias]?: Partial<ControlPanelSectionConfig>;
};
