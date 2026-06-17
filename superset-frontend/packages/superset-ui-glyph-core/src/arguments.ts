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

import {
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_OPTIONS,
} from '@superset-ui/chart-controls';
import {
  ColumnType,
  SelectOptions,
  SelectOption,
  TextOptions,
  CheckboxOptions,
  IntOptions,
  ColorOptions,
  MetricOptions,
  DimensionOptions,
  NumberFormatOptions,
  CurrencyOptions,
  CurrencyValue,
  TimeFormatOptions,
  ConditionalFormattingOptions,
  ConditionalFormattingRule,
  SliderOptions,
  BoundsOptions,
  BoundsValue,
  ColorPickerOptions,
  RadioButtonOptions,
  RadioOption,
  RgbaColor,
} from './types';

/**
 * Base Argument class - all argument types extend from this.
 *
 * Arguments define:
 * 1. What the chart needs (semantically)
 * 2. How to render controls in the control panel
 * 3. Default values and validation
 */
export class Argument {
  static label: string | null = null;
  static description: string | null = null;
  static columnType: ColumnType = ColumnType.Argument;
  static controlType: string = 'TextControl';

  value: unknown;

  constructor(value: unknown) {
    this.value = value;
  }
}

/**
 * Metric - represents a numeric aggregation (SUM, COUNT, AVG, etc.)
 *
 * Maps to Superset's MetricsControl in the query section.
 */
export class Metric extends Argument {
  static override label: string | null = 'Metric';
  static override description: string | null =
    'A numeric aggregation (SUM, COUNT, AVG, etc.)';
  static override columnType = ColumnType.Metric;
  static override controlType = 'MetricsControl';
  static multi = false;

  static with(options: MetricOptions): typeof Metric {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
      static override multi = options.multi ?? Base.multi;
    };
  }
}

/**
 * Dimension - represents a categorical column for grouping data
 *
 * Maps to Superset's GroupByControl in the query section.
 */
export class Dimension extends Argument {
  static override label: string | null = 'Dimension';
  static override description: string | null =
    'A categorical column for grouping data';
  static override columnType = ColumnType.Dimension;
  static override controlType = 'GroupByControl';
  static multi = true;

  static with(options: DimensionOptions): typeof Dimension {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
      static override multi = options.multi ?? Base.multi;
    };
  }
}

/**
 * Temporal - represents a time column
 *
 * Maps to Superset's temporal controls (x_axis, time_grain_sqla).
 */
export class Temporal extends Argument {
  static override label: string | null = 'Time Column';
  static override description: string | null =
    'A temporal column for time series data';
  static override columnType = ColumnType.Temporal;
  static override controlType = 'TemporalControl';

  static with(options: {
    label?: string;
    description?: string;
  }): typeof Temporal {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
    };
  }
}

/**
 * Select - dropdown selection from predefined options
 *
 * Maps to Superset's SelectControl.
 */
export class Select extends Argument {
  static override label: string | null = 'Select';
  static override description: string | null = 'Choose from options';
  static override controlType = 'SelectControl';
  static default: string | number = '';
  static options: SelectOption[] = [];
  static clearable = false;

  static with(options: SelectOptions): typeof Select {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
      static override default = options.default ?? Base.default;
      static override options = options.options ?? Base.options;
    };
  }
}

/**
 * Text - free-form text input
 *
 * Maps to Superset's TextControl.
 */
export class Text extends Argument {
  static override label: string | null = 'Text';
  static override description: string | null = 'Text input';
  static override controlType = 'TextControl';
  static default: string = '';
  static placeholder: string = '';

  static with(options: TextOptions): typeof Text {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
      static override default = options.default ?? Base.default;
      static override placeholder = options.placeholder ?? Base.placeholder;
    };
  }
}

/**
 * Checkbox - boolean toggle
 *
 * Maps to Superset's CheckboxControl.
 */
export class Checkbox extends Argument {
  static override label: string | null = 'Checkbox';
  static override description: string | null = 'Toggle option';
  static override controlType = 'CheckboxControl';
  static default: boolean = false;

  static with(options: CheckboxOptions): typeof Checkbox {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
      static override default = options.default ?? Base.default;
    };
  }
}

/**
 * Int - numeric input with slider
 *
 * Maps to Superset's SliderControl.
 */
export class Int extends Argument {
  static override label: string | null = 'Integer';
  static override description: string | null = 'A numeric value';
  static override controlType = 'SliderControl';
  static default: number = 0;
  static min: number = 0;
  static max: number = 100;
  static step: number = 1;

  static with(options: IntOptions): typeof Int {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
      static override default = options.default ?? Base.default;
      static override min = options.min ?? Base.min;
      static override max = options.max ?? Base.max;
      static override step = options.step ?? Base.step;
    };
  }
}

/**
 * Color - color picker
 *
 * Maps to Superset's ColorPickerControl.
 */
export class Color extends Argument {
  static override label: string | null = 'Color';
  static override description: string | null = 'A color value';
  static override controlType = 'ColorPickerControl';
  // eslint-disable-next-line theme-colors/no-literal-colors
  static default: string = '#000000';

  static with(options: ColorOptions): typeof Color {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
      static override default = options.default ?? Base.default;
    };
  }
}

/**
 * NumberFormat - D3 number format string selection
 *
 * Maps to Superset's SelectControl with D3 format options.
 * Allows freeform input for custom formats.
 */
export class NumberFormat extends Argument {
  static override label: string | null = 'Number Format';
  static override description: string | null =
    'D3 format string for number display (e.g., ".2f", ".1%", ",.0f")';
  static override controlType = 'NumberFormatControl';
  static default: string = 'SMART_NUMBER';

  // Standard D3 format options — derived from the canonical list in
  // @superset-ui/chart-controls so glyph charts offer the same formats
  // (with previews and translations) as legacy charts, and new formats
  // propagate automatically.
  static readonly FORMAT_OPTIONS: SelectOption[] = D3_FORMAT_OPTIONS.map(
    ([value, label]) => ({ value, label }),
  );

  static with(options: NumberFormatOptions): typeof NumberFormat {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
      static override default = options.default ?? Base.default;
    };
  }
}

/**
 * Currency - currency format with symbol and position
 *
 * Maps to Superset's CurrencyControl.
 * Value is { symbol: 'USD', symbolPosition: 'prefix' | 'suffix' }
 */
export class Currency extends Argument {
  static override label: string | null = 'Currency Format';
  static override description: string | null =
    'Currency symbol and position for formatting';
  static override controlType = 'CurrencyControl';
  static default: CurrencyValue = {};

  static with(options: CurrencyOptions): typeof Currency {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
      static override default = options.default ?? Base.default;
    };
  }
}

/**
 * TimeFormat - D3 time format string selection
 *
 * Maps to Superset's SelectControl with D3 time format options.
 * Allows freeform input for custom formats.
 */
export class TimeFormat extends Argument {
  static override label: string | null = 'Time Format';
  static override description: string | null =
    'D3 time format string (e.g., "%Y-%m-%d", "%H:%M:%S")';
  static override controlType = 'TimeFormatControl';
  static default: string = 'smart_date';

  // Standard D3 time format options — derived from the canonical list in
  // @superset-ui/chart-controls (see NumberFormat.FORMAT_OPTIONS).
  static readonly FORMAT_OPTIONS: SelectOption[] = D3_TIME_FORMAT_OPTIONS.map(
    ([value, label]) => ({ value, label }),
  );

  static with(options: TimeFormatOptions): typeof TimeFormat {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
      static override default = options.default ?? Base.default;
    };
  }
}

/**
 * ConditionalFormatting - apply color rules based on metric values
 *
 * This is a special argument type that encapsulates the complex
 * mapStateToProps logic needed for conditional formatting controls.
 * The control automatically receives numeric column options from the chart response.
 */
export class ConditionalFormatting extends Argument {
  static override label: string | null = 'Conditional Formatting';
  static override description: string | null =
    'Apply conditional color formatting to metric values';
  static override controlType = 'ConditionalFormattingControl';
  static default: ConditionalFormattingRule[] = [];

  static with(
    options: ConditionalFormattingOptions,
  ): typeof ConditionalFormatting {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
    };
  }
}

/**
 * Slider - continuous floating point values with min/max/step
 *
 * Similar to Int but for float values.
 * Maps to Superset's SliderControl.
 */
export class Slider extends Argument {
  static override label: string | null = 'Slider';
  static override description: string | null = 'A continuous numeric value';
  static override controlType = 'SliderControl';
  static default: number = 0;
  static min: number = 0;
  static max: number = 1;
  static step: number = 0.1;

  static with(options: SliderOptions): typeof Slider {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
      static override default = options.default ?? Base.default;
      static override min = options.min ?? Base.min;
      static override max = options.max ?? Base.max;
      static override step = options.step ?? Base.step;
    };
  }
}

/**
 * Bounds - min/max value pairs
 *
 * Used for axis bounds, value ranges, etc.
 * Maps to Superset's BoundsControl.
 */
export class Bounds extends Argument {
  static override label: string | null = 'Bounds';
  static override description: string | null = 'Min and max value bounds';
  static override controlType = 'BoundsControl';
  static default: BoundsValue = [null, null];

  static with(options: BoundsOptions): typeof Bounds {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
      static override default = options.default ?? Base.default;
    };
  }
}

/**
 * ColorPicker - RGBA color selection
 *
 * Different from Color (which uses hex strings).
 * Maps to Superset's ColorPickerControl with RGBA format.
 */
export class ColorPicker extends Argument {
  static override label: string | null = 'Color';
  static override description: string | null = 'Select a color';
  static override controlType = 'ColorPickerControl';
  static default: RgbaColor = { r: 0, g: 0, b: 0, a: 1 };

  static with(options: ColorPickerOptions): typeof ColorPicker {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
      static override default = options.default ?? Base.default;
    };
  }
}

/**
 * RadioButton - mutually exclusive options
 *
 * Use for small sets of exclusive choices (2-4 options).
 * Maps to Superset's RadioButtonControl.
 */
export class RadioButton extends Argument {
  static override label: string | null = 'Option';
  static override description: string | null = 'Select one option';
  static override controlType = 'RadioButtonControl';
  static default: string | boolean = '';
  static options: RadioOption[] = [];

  static with(options: RadioButtonOptions): typeof RadioButton {
    const Base = this;
    return class extends Base {
      static override label = options.label ?? Base.label;
      static override description = options.description ?? Base.description;
      static override default = options.default ?? Base.default;
      static override options = options.options;
    };
  }
}

/**
 * Type guard to check if an argument class is a ConditionalFormatting type
 */
export function isConditionalFormattingArg(
  argClass: typeof Argument,
): argClass is typeof ConditionalFormatting {
  return argClass.controlType === 'ConditionalFormattingControl';
}

/**
 * Type guard to check if an argument class is a TimeFormat type
 */
export function isTimeFormatArg(
  argClass: typeof Argument,
): argClass is typeof TimeFormat {
  return argClass.controlType === 'TimeFormatControl';
}

/**
 * Type guard to check if an argument class is a NumberFormat type
 */
export function isNumberFormatArg(
  argClass: typeof Argument,
): argClass is typeof NumberFormat {
  return argClass.controlType === 'NumberFormatControl';
}

/**
 * Type guard to check if an argument class is a Currency type
 */
export function isCurrencyArg(
  argClass: typeof Argument,
): argClass is typeof Currency {
  return argClass.controlType === 'CurrencyControl';
}

/**
 * Type guard to check if an argument class is a Select type
 */
export function isSelectArg(
  argClass: typeof Argument,
): argClass is typeof Select {
  return (
    'options' in argClass && Array.isArray((argClass as typeof Select).options)
  );
}

/**
 * Type guard to check if an argument class is a Checkbox type
 */
export function isCheckboxArg(
  argClass: typeof Argument,
): argClass is typeof Checkbox {
  return (
    'default' in argClass &&
    typeof (argClass as typeof Checkbox).default === 'boolean'
  );
}

/**
 * Type guard to check if an argument class is a Text type
 */
export function isTextArg(argClass: typeof Argument): argClass is typeof Text {
  return (
    argClass.controlType === 'TextControl' ||
    (argClass.prototype instanceof Text &&
      !isSelectArg(argClass) &&
      !isCheckboxArg(argClass))
  );
}

/**
 * Type guard to check if an argument class is an Int type
 */
export function isIntArg(argClass: typeof Argument): argClass is typeof Int {
  return 'min' in argClass && 'max' in argClass;
}

/**
 * Type guard to check if an argument class is a Color type
 */
export function isColorArg(
  argClass: typeof Argument,
): argClass is typeof Color {
  return (
    argClass.controlType === 'ColorPickerControl' ||
    argClass.prototype instanceof Color
  );
}

/**
 * Type guard to check if an argument class is a Metric type
 */
export function isMetricArg(
  argClass: typeof Argument,
): argClass is typeof Metric {
  return argClass.columnType === ColumnType.Metric;
}

/**
 * Type guard to check if an argument class is a Dimension type
 */
export function isDimensionArg(
  argClass: typeof Argument,
): argClass is typeof Dimension {
  return argClass.columnType === ColumnType.Dimension;
}

/**
 * Type guard to check if an argument class is a Temporal type
 */
export function isTemporalArg(
  argClass: typeof Argument,
): argClass is typeof Temporal {
  return argClass.columnType === ColumnType.Temporal;
}

/**
 * Type guard to check if an argument class is a Slider type
 */
export function isSliderArg(
  argClass: typeof Argument,
): argClass is typeof Slider {
  return (
    argClass.controlType === 'SliderControl' &&
    'step' in argClass &&
    typeof (argClass as typeof Slider).step === 'number'
  );
}

/**
 * Type guard to check if an argument class is a Bounds type
 */
export function isBoundsArg(
  argClass: typeof Argument,
): argClass is typeof Bounds {
  return argClass.controlType === 'BoundsControl';
}

/**
 * Type guard to check if an argument class is a ColorPicker type
 */
export function isColorPickerArg(
  argClass: typeof Argument,
): argClass is typeof ColorPicker {
  return (
    argClass.controlType === 'ColorPickerControl' &&
    'default' in argClass &&
    typeof (argClass as typeof ColorPicker).default === 'object' &&
    'r' in ((argClass as typeof ColorPicker).default as object)
  );
}

/**
 * Type guard to check if an argument class is a RadioButton type
 */
export function isRadioButtonArg(
  argClass: typeof Argument,
): argClass is typeof RadioButton {
  return argClass.controlType === 'RadioButtonControl';
}
