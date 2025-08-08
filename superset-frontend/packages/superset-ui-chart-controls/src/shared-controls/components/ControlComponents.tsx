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
import { ReactElement } from 'react';
import type { CustomControlItem, ControlValueValidator } from '../../types';

// Base control props that all controls share
interface BaseControlProps {
  name: string;
  label?: ReactElement | string;
  description?: string;
  default?: any;
  renderTrigger?: boolean;
  validators?: ControlValueValidator[];
  warning?: string;
  error?: string;
  mapStateToProps?: (state: any, control: any) => any;
  visibility?: (props: any) => boolean;
  value?: any;
  onChange?: (value: any) => void;
}

// Use the existing CustomControlItem type instead of creating a duplicate
// This ensures type compatibility with the rest of the codebase
export type ControlComponentConfig = CustomControlItem;

// CheckboxControl Component
interface CheckboxControlProps extends BaseControlProps {
  default?: boolean;
}

export const CheckboxControl = (
  props: CheckboxControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'CheckboxControl',
    label: props.label,
    description: props.description,
    default: props.default ?? false,
    renderTrigger: props.renderTrigger ?? false,
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    mapStateToProps: props.mapStateToProps,
    visibility: props.visibility,
  },
});

// SelectControl Component
interface SelectControlProps extends BaseControlProps {
  choices?: Array<[string, string]> | (() => Array<[string, string]>);
  clearable?: boolean;
  freeForm?: boolean;
  multi?: boolean;
  placeholder?: string;
  optionRenderer?: (option: any) => ReactElement;
  valueRenderer?: (value: any) => ReactElement;
  valueKey?: string;
  labelKey?: string;
}

export const SelectControl = (
  props: SelectControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'SelectControl',
    label: props.label,
    description: props.description,
    choices: props.choices ?? [],
    clearable: props.clearable ?? true,
    freeForm: props.freeForm ?? false,
    multi: props.multi ?? false,
    default: props.default,
    renderTrigger: props.renderTrigger ?? false,
    placeholder: props.placeholder,
    mapStateToProps: props.mapStateToProps,
    visibility: props.visibility,
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    optionRenderer: props.optionRenderer,
    valueRenderer: props.valueRenderer,
    valueKey: props.valueKey,
    labelKey: props.labelKey,
  },
});

// TextControl Component
interface TextControlProps extends BaseControlProps {
  placeholder?: string;
  disabled?: boolean;
  isInt?: boolean;
  isFloat?: boolean;
}

export const TextControl = (
  props: TextControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'TextControl',
    label: props.label,
    description: props.description,
    placeholder: props.placeholder,
    default: props.default ?? '',
    renderTrigger: props.renderTrigger ?? false,
    disabled: props.disabled ?? false,
    isInt: props.isInt ?? false,
    isFloat: props.isFloat ?? false,
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    mapStateToProps: props.mapStateToProps,
    visibility: props.visibility,
  },
});

// TextAreaControl Component
interface TextAreaControlProps extends BaseControlProps {
  placeholder?: string;
  rows?: number;
  language?: 'json' | 'html' | 'sql' | 'markdown' | 'javascript';
  offerEditInModal?: boolean;
  disabled?: boolean;
}

export const TextAreaControl = (
  props: TextAreaControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'TextAreaControl',
    label: props.label,
    description: props.description,
    placeholder: props.placeholder,
    rows: props.rows ?? 3,
    language: props.language,
    offerEditInModal: props.offerEditInModal ?? true,
    default: props.default ?? '',
    renderTrigger: props.renderTrigger ?? false,
    disabled: props.disabled ?? false,
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    mapStateToProps: props.mapStateToProps,
    visibility: props.visibility,
  },
});

// SliderControl Component
interface SliderControlProps extends BaseControlProps {
  min?: number;
  max?: number;
  step?: number;
  default?: number;
}

export const SliderControl = (
  props: SliderControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'SliderControl',
    label: props.label,
    description: props.description,
    min: props.min ?? 0,
    max: props.max ?? 100,
    step: props.step ?? 1,
    default: props.default ?? 0,
    renderTrigger: props.renderTrigger ?? false,
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    mapStateToProps: props.mapStateToProps,
    visibility: props.visibility,
  },
});

// RadioButtonControl Component
interface RadioButtonControlProps extends BaseControlProps {
  options?: Array<[string, string | ReactElement]>;
  default?: string;
}

export const RadioButtonControl = (
  props: RadioButtonControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'RadioButtonControl',
    label: props.label,
    description: props.description,
    options: props.options ?? [],
    default: props.default,
    renderTrigger: props.renderTrigger ?? false,
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    mapStateToProps: props.mapStateToProps,
    visibility: props.visibility,
  },
});

// NumberControl Component
interface NumberControlProps extends BaseControlProps {
  min?: number;
  max?: number;
  default?: number;
  placeholder?: string;
}

export const NumberControl = (
  props: NumberControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'TextControl',
    label: props.label,
    description: props.description,
    placeholder: props.placeholder,
    default: props.default,
    renderTrigger: props.renderTrigger ?? false,
    isFloat: true,
    controlHeader: {
      label: props.label,
      description: props.description,
    },
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    mapStateToProps: props.mapStateToProps,
    visibility: props.visibility,
    min: props.min,
    max: props.max,
  },
});

// ColorPickerControl Component
interface ColorPickerControlProps extends BaseControlProps {
  default?: { r: number; g: number; b: number; a?: number };
}

export const ColorPickerControl = (
  props: ColorPickerControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'ColorPickerControl',
    label: props.label,
    description: props.description,
    default: props.default ?? { r: 0, g: 122, b: 135, a: 1 },
    renderTrigger: props.renderTrigger ?? false,
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    mapStateToProps: props.mapStateToProps,
    visibility: props.visibility,
  },
});

// DateFilterControl Component
interface DateFilterControlProps extends BaseControlProps {
  default?: string;
}

export const DateFilterControl = (
  props: DateFilterControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'DateFilterControl',
    label: props.label,
    description: props.description,
    default: props.default,
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    mapStateToProps: props.mapStateToProps,
    visibility: props.visibility,
    renderTrigger: props.renderTrigger,
  },
});

// BoundsControl Component
interface BoundsControlProps extends BaseControlProps {
  default?: [number | null, number | null];
  min?: number;
  max?: number;
}

export const BoundsControl = (
  props: BoundsControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'BoundsControl',
    label: props.label,
    description: props.description,
    default: props.default ?? [null, null],
    min: props.min,
    max: props.max,
    renderTrigger: props.renderTrigger ?? false,
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    mapStateToProps: props.mapStateToProps,
    visibility: props.visibility,
  },
});

// SwitchControl Component
interface SwitchControlProps extends BaseControlProps {
  default?: boolean;
}

export const SwitchControl = (
  props: SwitchControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'CheckboxControl',
    label: props.label,
    description: props.description,
    default: props.default ?? false,
    renderTrigger: props.renderTrigger ?? false,
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    mapStateToProps: props.mapStateToProps,
    visibility: props.visibility,
  },
});

// HiddenControl Component (for hidden fields)
interface HiddenControlProps {
  name: string;
  value?: any;
  default?: any;
}

export const HiddenControl = (
  props: HiddenControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'HiddenControl',
    default: props.default,
    value: props.value,
    renderTrigger: false,
    visible: false,
  },
});

// MetricsControl Component
interface MetricsControlProps extends BaseControlProps {
  multi?: boolean;
  clearable?: boolean;
  savedMetrics?: any[];
  columns?: any[];
  datasourceType?: string;
}

export const MetricsControl = (
  props: MetricsControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'MetricsControl',
    label: props.label,
    description: props.description,
    multi: props.multi ?? true,
    clearable: props.clearable ?? true,
    validators: props.validators ?? [],
    mapStateToProps:
      props.mapStateToProps ||
      ((state: any) => ({
        columns: state.datasource?.columns || [],
        savedMetrics: state.datasource?.metrics || [],
        datasourceType: state.datasource?.type,
      })),
    default: props.default,
    renderTrigger: props.renderTrigger,
    warning: props.warning,
    error: props.error,
    visibility: props.visibility,
    savedMetrics: props.savedMetrics,
    columns: props.columns,
    datasourceType: props.datasourceType,
  },
});

// GroupByControl Component
interface GroupByControlProps extends BaseControlProps {
  multi?: boolean;
  clearable?: boolean;
  columns?: any[];
}

export const GroupByControl = (
  props: GroupByControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'SelectControl',
    label: props.label,
    description: props.description,
    multi: props.multi ?? true,
    clearable: props.clearable ?? true,
    validators: props.validators ?? [],
    mapStateToProps:
      props.mapStateToProps ||
      ((state: any) => ({
        choices: state.datasource?.columns || [],
      })),
    default: props.default,
    renderTrigger: props.renderTrigger,
    warning: props.warning,
    error: props.error,
    visibility: props.visibility,
    columns: props.columns,
  },
});

// AdhocFilterControl Component
interface AdhocFilterControlProps extends BaseControlProps {
  columns?: any[];
  savedMetrics?: any[];
  datasourceType?: string;
}

export const AdhocFilterControl = (
  props: AdhocFilterControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'AdhocFilterControl',
    label: props.label,
    description: props.description,
    mapStateToProps:
      props.mapStateToProps ||
      ((state: any) => ({
        columns: state.datasource?.columns || [],
        savedMetrics: state.datasource?.metrics || [],
        datasourceType: state.datasource?.type,
      })),
    default: props.default,
    renderTrigger: props.renderTrigger,
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    visibility: props.visibility,
    columns: props.columns,
    savedMetrics: props.savedMetrics,
    datasourceType: props.datasourceType,
  },
});

// SpatialControl Component
interface SpatialControlProps extends BaseControlProps {
  choices?: any[];
}

export const SpatialControl = (
  props: SpatialControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'SpatialControl',
    label: props.label,
    description: props.description,
    validators: props.validators,
    mapStateToProps:
      props.mapStateToProps ||
      ((state: any) => ({
        choices: state.datasource?.columns || [],
      })),
    default: props.default,
    renderTrigger: props.renderTrigger,
    warning: props.warning,
    error: props.error,
    visibility: props.visibility,
  },
});

// ColorSchemeControl Component
interface ColorSchemeControlProps extends BaseControlProps {
  choices?: (() => Array<[string, string]>) | Array<[string, string]>;
  schemes?: () => any;
  isLinear?: boolean;
}

export const ColorSchemeControl = (
  props: ColorSchemeControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'ColorSchemeControl',
    label: props.label,
    description: props.description,
    default: props.default,
    renderTrigger: props.renderTrigger ?? true,
    choices: props.choices,
    schemes: props.schemes,
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    mapStateToProps: props.mapStateToProps,
    visibility: props.visibility,
    isLinear: props.isLinear,
  },
});

// SelectAsyncControl Component
interface SelectAsyncControlProps extends BaseControlProps {
  dataEndpoint?: string;
  multi?: boolean;
  mutator?: (data: any) => any;
  placeholder?: string;
  onAsyncErrorMessage?: string;
  cacheOptions?: boolean;
}

export const SelectAsyncControl = (
  props: SelectAsyncControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'SelectAsyncControl',
    label: props.label,
    description: props.description,
    default: props.default,
    dataEndpoint: props.dataEndpoint,
    multi: props.multi ?? false,
    mutator: props.mutator,
    placeholder: props.placeholder,
    onAsyncErrorMessage: props.onAsyncErrorMessage,
    cacheOptions: props.cacheOptions ?? true,
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    mapStateToProps: props.mapStateToProps,
    visibility: props.visibility,
    renderTrigger: props.renderTrigger,
  },
});

// ContourControl Component
interface ContourControlProps extends BaseControlProps {
  renderTrigger?: boolean;
  choices?: Array<[string, string]>;
}

export const ContourControl = (
  props: ContourControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'ContourControl',
    label: props.label,
    description: props.description,
    default: props.default,
    renderTrigger: props.renderTrigger ?? true,
    choices: props.choices,
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    mapStateToProps: props.mapStateToProps,
    visibility: props.visibility,
  },
});

// ColumnConfigControl Component
interface ColumnConfigControlProps extends BaseControlProps {
  renderTrigger?: boolean;
}

export const ColumnConfigControl = (
  props: ColumnConfigControlProps,
): ControlComponentConfig => ({
  name: props.name,
  config: {
    type: 'ColumnConfigControl',
    label: props.label,
    description: props.description,
    default: props.default,
    renderTrigger: props.renderTrigger ?? true,
    validators: props.validators,
    warning: props.warning,
    error: props.error,
    mapStateToProps: props.mapStateToProps,
    visibility: props.visibility,
  },
});

// Export all components
export default {
  CheckboxControl,
  SelectControl,
  TextControl,
  TextAreaControl,
  SliderControl,
  RadioButtonControl,
  NumberControl,
  ColorPickerControl,
  DateFilterControl,
  BoundsControl,
  SwitchControl,
  HiddenControl,
  MetricsControl,
  GroupByControl,
  AdhocFilterControl,
  SpatialControl,
  ColorSchemeControl,
  SelectAsyncControl,
  ContourControl,
  ColumnConfigControl,
};
