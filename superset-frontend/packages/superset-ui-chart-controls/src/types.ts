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
import type {
  AdhocColumn,
  Column,
  DatasourceType,
  JsonValue,
  Metric,
  QueryFormData,
} from '@superset-ui/core';
import { sharedControls } from './shared-controls';
import sharedControlComponents from './shared-controls/components';

export type { Metric } from '@superset-ui/core';
export type { ControlFormItemSpec } from './components/ControlForm';
export type { ControlComponentProps } from './shared-controls/components/types';

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
export type ColumnMeta = Omit<Column, 'id'> & {
  id?: number;
} & AnyDict;

export interface DatasourceMeta {
  id: number;
  type: DatasourceType;
  columns: ColumnMeta[];
  metrics: Metric[];
  column_format: Record<string, string>;
  verbose_map: Record<string, string>;
  main_dttm_col: string;
  // eg. ['["ds", true]', 'ds [asc]']
  order_by_choices?: [string, string][] | null;
  time_grain_sqla?: string;
  granularity_sqla?: string;
  datasource_name: string | null;
  description: string | null;
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
export interface ActionDispatcher<
  ARGS extends unknown[],
  A extends Action = AnyAction,
> {
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
export type ExtraControlProps = {
  value?: JsonValue;
} & AnyDict;

// Ref:superset-frontend/src/explore/store.js
export type ControlState<
  T = ControlType,
  O extends SelectOption = SelectOption,
> = ControlConfig<T, O> & ExtraControlProps;

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
  | 'DndColumnSelect'
  | 'DndFilterSelect'
  | 'DndMetricSelect'
  | keyof SharedControlComponents; // expanded in `expandControlConfig`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ControlType = InternalControlType | React.ComponentType<any>;

export type TabOverride = 'data' | 'customize' | boolean;

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
 * - shouldMapStateToProps: a function that receives the previous and current app state
 *   and determines if the control needs to recalculate it's props based on the new state.
 * - mapStateToProps: a function that receives the App's state and return an object of k/v
 *    to overwrite configuration at runtime. This is useful to alter a component based on
 *    anything external to it, like another control's value. For instance it's possible to
 *    show a warning based on the value of another component. It's also possible to bind
 *    arbitrary data from the redux store to the component this way.
 * - tabOverride: set to 'data' if you want to force a renderTrigger to show up on the `Data`
     tab, or 'customize' if you want it to show up on that tam. Otherwise sections with ALL
     `renderTrigger: true` components will show up on the `Customize` tab.
 * - visibility: a function that uses control panel props to check whether a control should
 *    be visibile.
 */
export interface BaseControlConfig<
  T extends ControlType = ControlType,
  O extends SelectOption = SelectOption,
  V = JsonValue,
> extends AnyDict {
  type: T;
  label?: ReactNode;
  description?: ReactNode;
  default?: V;
  renderTrigger?: boolean;
  validators?: ControlValueValidator<T, O, V>[];
  warning?: ReactNode;
  error?: ReactNode;
  /**
   * Add additional props to chart control.
   */
  shouldMapStateToProps?: (
    prevState: ControlPanelState,
    state: ControlPanelState,
    controlState: ControlState,
    // TODO: add strict `chartState` typing (see superset-frontend/src/explore/types)
    chartState?: AnyDict,
  ) => boolean;
  mapStateToProps?: (
    state: ControlPanelState,
    controlState: ControlState,
    // TODO: add strict `chartState` typing (see superset-frontend/src/explore/types)
    chartState?: AnyDict,
  ) => ExtraControlProps;
  visibility?: (props: ControlPanelsContainerProps) => boolean;
}

export interface ControlValueValidator<
  T = ControlType,
  O extends SelectOption = SelectOption,
  V = unknown,
> {
  (value: V, state?: ControlState<T, O>): boolean | string;
}

/** --------------------------------------------
 * Additional Config for specific control Types
 * --------------------------------------------- */
export type SelectOption = AnyDict | string | [ReactText, ReactNode];

export type SelectControlType =
  | 'SelectControl'
  | 'SelectAsyncControl'
  | 'MetricsControl'
  | 'FixedOrMetricControl'
  | 'AdhocFilterControl'
  | 'FilterBoxItemControl';

// via react-select/src/filters
export interface FilterOption<T extends SelectOption> {
  label: string;
  value: string;
  data: T;
}

// Ref: superset-frontend/src/components/Select/SupersetStyledSelect.tsx
export interface SelectControlConfig<
  O extends SelectOption = SelectOption,
  T extends SelectControlType = SelectControlType,
> extends BaseControlConfig<T, O> {
  clearable?: boolean;
  freeForm?: boolean;
  multi?: boolean;
  valueKey?: string;
  labelKey?: string;
  options?: O[];
  optionRenderer?: (option: O) => ReactNode;
  valueRenderer?: (option: O) => ReactNode;
  filterOption?:
    | ((option: FilterOption<O>, rawInput: string) => Boolean)
    | null;
}

export type SharedControlConfig<
  T extends InternalControlType = InternalControlType,
  O extends SelectOption = SelectOption,
> = T extends SelectControlType
  ? SelectControlConfig<O, T>
  : BaseControlConfig<T>;

/** --------------------------------------------
 * Custom controls
 * --------------------------------------------- */
export type CustomControlConfig<P = {}> = BaseControlConfig<
  React.ComponentType<P>
> &
  // two run-time properties from superset-frontend/src/explore/components/Control.jsx
  Omit<P, 'onChange' | 'hovered'>;

// Catch-all ControlConfig
//  - if T is known control types, return SharedControlConfig,
//  - if T is object, assume a CustomComponent
//  - otherwise assume it's a custom component control
export type ControlConfig<
  T = AnyDict,
  O extends SelectOption = SelectOption,
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

export interface OverrideSharedControlItem<
  A extends SharedControlAlias = SharedControlAlias,
> {
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

export type ControlSetItem =
  | SharedControlAlias
  | OverrideSharedControlItem
  | ExpandedControlItem;

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

// Ref:
//  - superset-frontend/src/explore/components/ConditionalFormattingControl.tsx
export enum COMPARATOR {
  NONE = 'None',
  GREATER_THAN = '>',
  LESS_THAN = '<',
  GREATER_OR_EQUAL = '≥',
  LESS_OR_EQUAL = '≤',
  EQUAL = '=',
  NOT_EQUAL = '≠',
  BETWEEN = '< x <',
  BETWEEN_OR_EQUAL = '≤ x ≤',
  BETWEEN_OR_LEFT_EQUAL = '≤ x <',
  BETWEEN_OR_RIGHT_EQUAL = '< x ≤',
}

export const MULTIPLE_VALUE_COMPARATORS = [
  COMPARATOR.BETWEEN,
  COMPARATOR.BETWEEN_OR_EQUAL,
  COMPARATOR.BETWEEN_OR_LEFT_EQUAL,
  COMPARATOR.BETWEEN_OR_RIGHT_EQUAL,
];

export type ConditionalFormattingConfig = {
  operator?: COMPARATOR;
  targetValue?: number;
  targetValueLeft?: number;
  targetValueRight?: number;
  column?: string;
  colorScheme?: string;
};

export type ColorFormatters = {
  column: string;
  getColorFromValue: (value: number) => string | undefined;
}[];

export default {};

export function isColumnMeta(
  column: AdhocColumn | ColumnMeta,
): column is ColumnMeta {
  return 'column_name' in column;
}

export function isSavedExpression(
  column: AdhocColumn | ColumnMeta,
): column is ColumnMeta {
  return (
    'column_name' in column && 'expression' in column && !!column.expression
  );
}

export function isAdhocColumn(
  column: AdhocColumn | ColumnMeta,
): column is AdhocColumn {
  return 'label' in column && 'sqlExpression' in column;
}
