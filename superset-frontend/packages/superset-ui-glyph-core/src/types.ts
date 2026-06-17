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

/**
 * Option for Select controls
 */
export interface SelectOption {
  label: string;
  value: string | number;
}

/**
 * Configuration options for Select argument type
 */
export interface SelectOptions {
  label?: string;
  description?: string;
  default?: string | number;
  options?: SelectOption[];
  clearable?: boolean;
  renderTrigger?: boolean;
}

/**
 * Configuration options for Text argument type
 */
export interface TextOptions {
  label?: string;
  description?: string;
  default?: string;
  placeholder?: string;
}

/**
 * Configuration options for Checkbox argument type
 */
export interface CheckboxOptions {
  label?: string;
  description?: string;
  default?: boolean;
}

/**
 * Configuration options for Int argument type (slider)
 */
export interface IntOptions {
  label?: string;
  description?: string;
  default?: number;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Configuration options for Color argument type
 */
export interface ColorOptions {
  label?: string;
  description?: string;
  default?: string;
}

/**
 * Configuration options for Metric argument type
 */
export interface MetricOptions {
  label?: string;
  description?: string;
  multi?: boolean;
}

/**
 * Configuration options for Dimension argument type
 */
export interface DimensionOptions {
  label?: string;
  description?: string;
  multi?: boolean;
}

/**
 * Configuration options for NumberFormat argument type
 */
export interface NumberFormatOptions {
  label?: string;
  description?: string;
  default?: string;
}

/**
 * Currency value structure
 */
export interface CurrencyValue {
  symbol?: string;
  symbolPosition?: 'prefix' | 'suffix';
}

/**
 * Configuration options for Currency argument type
 */
export interface CurrencyOptions {
  label?: string;
  description?: string;
  default?: CurrencyValue;
}

/**
 * Configuration options for TimeFormat argument type
 */
export interface TimeFormatOptions {
  label?: string;
  description?: string;
  default?: string;
}

/**
 * Configuration options for ConditionalFormatting argument type
 */
export interface ConditionalFormattingOptions {
  label?: string;
  description?: string;
}

/**
 * Configuration options for Slider argument type (continuous float values)
 */
export interface SliderOptions {
  label?: string;
  description?: string;
  default?: number;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Configuration options for Bounds argument type (min/max pairs)
 */
export interface BoundsOptions {
  label?: string;
  description?: string;
  default?: [number | null, number | null];
}

/**
 * Bounds value type - tuple of [min, max] where either can be null
 */
export type BoundsValue = [number | null, number | null];

/**
 * Configuration options for ColorPicker argument type (RGBA colors)
 */
export interface ColorPickerOptions {
  label?: string;
  description?: string;
  default?: RgbaColor;
}

/**
 * Configuration options for RadioButton argument type
 */
export interface RadioButtonOptions {
  label?: string;
  description?: string;
  default?: string | boolean;
  options: RadioOption[];
}

/**
 * Option for RadioButton controls
 */
export interface RadioOption {
  label: string;
  value: string | boolean;
}

/**
 * Conditional formatting rule value
 */
export interface ConditionalFormattingRule {
  column?: string;
  operator?: '<' | '<=' | '>' | '>=' | '==' | '!=' | 'between';
  targetValue?: number;
  targetValueLeft?: number;
  targetValueRight?: number;
  colorScheme?: string;
}

/**
 * Column type enum for data arguments
 */
export enum ColumnType {
  Metric = 'metric',
  Dimension = 'dimension',
  Temporal = 'temporal',
  Argument = 'argument',
}

/**
 * RGBA color format used by Superset's ColorPickerControl
 */
export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Visibility function for conditional control display (legacy)
 */
export type VisibilityFn = (state: {
  controls: Record<string, { value: unknown }>;
}) => boolean;

/**
 * Declarative condition for argument visibility/disabled state.
 *
 * Keys are argument names, values define the condition:
 * - Literal value: equality check (e.g., { showMetricName: true })
 * - Function: custom check (e.g., { subtitle: (val) => !!val })
 *
 * Multiple keys are AND'd together.
 *
 * @example
 * // Visible when showMetricName is true
 * visibleWhen: { showMetricName: true }
 *
 * @example
 * // Visible when subtitle is not empty
 * visibleWhen: { subtitle: (val) => !!val }
 *
 * @example
 * // Visible when showMetricName is true AND subtitle is not empty
 * visibleWhen: { showMetricName: true, subtitle: (val) => !!val }
 */
export type ArgumentCondition = Record<
  string,
  unknown | ((value: unknown) => boolean)
>;
