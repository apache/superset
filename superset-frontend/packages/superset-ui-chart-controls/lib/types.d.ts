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
import type { AdhocColumn, Column, DatasourceType, JsonValue, Metric, QueryFormData } from '@superset-ui/core';
import { sharedControls } from './shared-controls';
import sharedControlComponents from './shared-controls/components';
export type { Metric } from '@superset-ui/core';
export type { ControlFormItemSpec } from './components/ControlForm';
export type { ControlComponentProps } from './shared-controls/components/types';
declare type AnyDict = Record<string, any>;
interface Action {
    type: string;
}
interface AnyAction extends Action, AnyDict {
}
export declare type SharedControls = typeof sharedControls;
export declare type SharedControlAlias = keyof typeof sharedControls;
export declare type SharedControlComponents = typeof sharedControlComponents;
/** ----------------------------------------------
 * Input data/props while rendering
 * ---------------------------------------------*/
export declare type ColumnMeta = Omit<Column, 'id'> & {
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
export declare type ExtraControlProps = {
    value?: JsonValue;
} & AnyDict;
export declare type ControlState<T = ControlType, O extends SelectOption = SelectOption> = ControlConfig<T, O> & ExtraControlProps;
export interface ControlStateMapping {
    [key: string]: ControlState;
}
export interface ControlPanelsContainerProps extends AnyDict {
    actions: ControlPanelActionDispatchers;
    controls: ControlStateMapping;
    exportState: AnyDict;
    form_data: QueryFormData;
}
/** ----------------------------------------------
 * Config for a chart Control
 * ---------------------------------------------*/
export declare type InternalControlType = 'AnnotationLayerControl' | 'BoundsControl' | 'CheckboxControl' | 'CollectionControl' | 'ColorPickerControl' | 'ColorSchemeControl' | 'DatasourceControl' | 'DateFilterControl' | 'FixedOrMetricControl' | 'HiddenControl' | 'SelectAsyncControl' | 'SelectControl' | 'SliderControl' | 'SpatialControl' | 'TextAreaControl' | 'TextControl' | 'TimeSeriesColumnControl' | 'ViewportControl' | 'VizTypeControl' | 'MetricsControl' | 'AdhocFilterControl' | 'FilterBoxItemControl' | 'DndColumnSelect' | 'DndFilterSelect' | 'DndMetricSelect' | keyof SharedControlComponents;
export declare type ControlType = InternalControlType | React.ComponentType<any>;
export declare type TabOverride = 'data' | 'customize' | boolean;
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
     tab, or 'customize' if you want it to show up on that tam. Otherwise sections with ALL
     `renderTrigger: true` components will show up on the `Customize` tab.
 * - visibility: a function that uses control panel props to check whether a control should
 *    be visibile.
 */
export interface BaseControlConfig<T extends ControlType = ControlType, O extends SelectOption = SelectOption, V = JsonValue> extends AnyDict {
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
    mapStateToProps?: (state: ControlPanelState, controlState: ControlState, chartState?: AnyDict) => ExtraControlProps;
    visibility?: (props: ControlPanelsContainerProps) => boolean;
}
export interface ControlValueValidator<T = ControlType, O extends SelectOption = SelectOption, V = unknown> {
    (value: V, state?: ControlState<T, O>): boolean | string;
}
/** --------------------------------------------
 * Additional Config for specific control Types
 * --------------------------------------------- */
export declare type SelectOption = AnyDict | string | [ReactText, ReactNode];
export declare type SelectControlType = 'SelectControl' | 'SelectAsyncControl' | 'MetricsControl' | 'FixedOrMetricControl' | 'AdhocFilterControl' | 'FilterBoxItemControl';
export interface FilterOption<T extends SelectOption> {
    label: string;
    value: string;
    data: T;
}
export interface SelectControlConfig<O extends SelectOption = SelectOption, T extends SelectControlType = SelectControlType> extends BaseControlConfig<T, O> {
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
export declare type SharedControlConfig<T extends InternalControlType = InternalControlType, O extends SelectOption = SelectOption> = T extends SelectControlType ? SelectControlConfig<O, T> : BaseControlConfig<T>;
/** --------------------------------------------
 * Custom controls
 * --------------------------------------------- */
export declare type CustomControlConfig<P = {}> = BaseControlConfig<React.ComponentType<P>> & Omit<P, 'onChange' | 'hovered'>;
export declare type ControlConfig<T = AnyDict, O extends SelectOption = SelectOption> = T extends InternalControlType ? SharedControlConfig<T, O> : T extends object ? CustomControlConfig<T> : CustomControlConfig<any>;
/** ===========================================================
 * Chart plugin control panel config
 * ========================================================= */
export declare type SharedSectionAlias = 'annotations' | 'colorScheme' | 'datasourceAndVizType' | 'druidTimeSeries' | 'sqlaTimeSeries' | 'NVD3TimeSeries';
export interface OverrideSharedControlItem<A extends SharedControlAlias = SharedControlAlias> {
    name: A;
    override: Partial<SharedControls[A]>;
}
export declare type CustomControlItem = {
    name: string;
    config: BaseControlConfig<any, any, any>;
};
export declare type ExpandedControlItem = CustomControlItem | ReactElement | null;
export declare type ControlSetItem = SharedControlAlias | OverrideSharedControlItem | ExpandedControlItem;
export declare type ControlSetRow = ControlSetItem[];
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
export declare type ControlOverrides = {
    [P in SharedControlAlias]?: Partial<SharedControls[P]>;
};
export declare type SectionOverrides = {
    [P in SharedSectionAlias]?: Partial<ControlPanelSectionConfig>;
};
export declare enum COMPARATOR {
    NONE = "None",
    GREATER_THAN = ">",
    LESS_THAN = "<",
    GREATER_OR_EQUAL = "\u2265",
    LESS_OR_EQUAL = "\u2264",
    EQUAL = "=",
    NOT_EQUAL = "\u2260",
    BETWEEN = "< x <",
    BETWEEN_OR_EQUAL = "\u2264 x \u2264",
    BETWEEN_OR_LEFT_EQUAL = "\u2264 x <",
    BETWEEN_OR_RIGHT_EQUAL = "< x \u2264"
}
export declare const MULTIPLE_VALUE_COMPARATORS: COMPARATOR[];
export declare type ConditionalFormattingConfig = {
    operator?: COMPARATOR;
    targetValue?: number;
    targetValueLeft?: number;
    targetValueRight?: number;
    column?: string;
    colorScheme?: string;
};
export declare type ColorFormatters = {
    column: string;
    getColorFromValue: (value: number) => string | undefined;
}[];
declare const _default: {};
export default _default;
export declare function isColumnMeta(column: AdhocColumn | ColumnMeta): column is ColumnMeta;
export declare function isSavedExpression(column: AdhocColumn | ColumnMeta): column is ColumnMeta;
export declare function isAdhocColumn(column: AdhocColumn | ColumnMeta): column is AdhocColumn;
//# sourceMappingURL=types.d.ts.map