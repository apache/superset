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
  Argument,
  Bounds,
  Checkbox,
  Color,
  ColorPicker,
  ConditionalFormatting,
  Currency,
  Dimension,
  Int,
  isBoundsArg,
  isCheckboxArg,
  isColorArg,
  isColorPickerArg,
  isConditionalFormattingArg,
  isCurrencyArg,
  isDimensionArg,
  isIntArg,
  isMetricArg,
  isNumberFormatArg,
  isRadioButtonArg,
  isSelectArg,
  isSliderArg,
  isTemporalArg,
  isTextArg,
  isTimeFormatArg,
  Metric,
  NumberFormat,
  RadioButton,
  Select,
  Slider,
  Temporal,
  Text,
  TimeFormat,
} from '@superset-ui/glyph-core';
import { ColumnType } from '@superset-ui/glyph-core/types';

describe('Argument base class', () => {
  test('stores its constructor value', () => {
    const a = new Argument(42);
    expect(a.value).toBe(42);
  });

  test('has expected static defaults', () => {
    expect(Argument.label).toBeNull();
    expect(Argument.description).toBeNull();
    expect(Argument.columnType).toBe(ColumnType.Argument);
    expect(Argument.controlType).toBe('TextControl');
  });
});

describe('Metric', () => {
  test('has expected static metadata', () => {
    expect(Metric.label).toBe('Metric');
    expect(Metric.columnType).toBe(ColumnType.Metric);
    expect(Metric.controlType).toBe('MetricsControl');
    expect(Metric.multi).toBe(false);
  });

  test('.with() overrides label, description, multi', () => {
    const M = Metric.with({
      label: 'Sales',
      description: 'Total sales',
      multi: true,
    });
    expect(M.label).toBe('Sales');
    expect(M.description).toBe('Total sales');
    expect(M.multi).toBe(true);
    // unaltered ancestor metadata still present
    expect(M.columnType).toBe(ColumnType.Metric);
    expect(M.controlType).toBe('MetricsControl');
  });

  test('.with() falls back to parent defaults when option omitted', () => {
    const M = Metric.with({ label: 'X' });
    expect(M.label).toBe('X');
    expect(M.multi).toBe(Metric.multi);
    expect(M.description).toBe(Metric.description);
  });

  test('isMetricArg type guard', () => {
    expect(isMetricArg(Metric)).toBe(true);
    expect(isMetricArg(Metric.with({ label: 'X' }))).toBe(true);
    expect(isMetricArg(Dimension)).toBe(false);
    expect(isMetricArg(Select)).toBe(false);
  });
});

describe('Dimension', () => {
  test('has expected static metadata', () => {
    expect(Dimension.label).toBe('Dimension');
    expect(Dimension.columnType).toBe(ColumnType.Dimension);
    expect(Dimension.controlType).toBe('GroupByControl');
    expect(Dimension.multi).toBe(true);
  });

  test('.with() overrides label, description, multi', () => {
    const D = Dimension.with({
      label: 'Region',
      multi: false,
    });
    expect(D.label).toBe('Region');
    expect(D.multi).toBe(false);
  });

  test('isDimensionArg type guard', () => {
    expect(isDimensionArg(Dimension)).toBe(true);
    expect(isDimensionArg(Dimension.with({ label: 'X' }))).toBe(true);
    expect(isDimensionArg(Metric)).toBe(false);
  });
});

describe('Temporal', () => {
  test('has expected static metadata', () => {
    expect(Temporal.label).toBe('Time Column');
    expect(Temporal.columnType).toBe(ColumnType.Temporal);
    expect(Temporal.controlType).toBe('TemporalControl');
  });

  test('.with() overrides label and description', () => {
    const T = Temporal.with({ label: 'Order Date' });
    expect(T.label).toBe('Order Date');
  });

  test('isTemporalArg type guard', () => {
    expect(isTemporalArg(Temporal)).toBe(true);
    expect(isTemporalArg(Metric)).toBe(false);
  });
});

describe('Select', () => {
  const OPTIONS = [
    { label: 'A', value: 'a' },
    { label: 'B', value: 'b' },
  ];

  test('has expected static defaults', () => {
    expect(Select.label).toBe('Select');
    expect(Select.controlType).toBe('SelectControl');
    expect(Select.options).toEqual([]);
    expect(Select.default).toBe('');
  });

  test('.with() applies label, default, options', () => {
    const S = Select.with({
      label: 'Choice',
      default: 'a',
      options: OPTIONS,
    });
    expect(S.label).toBe('Choice');
    expect(S.default).toBe('a');
    expect(S.options).toEqual(OPTIONS);
  });

  test('isSelectArg type guard', () => {
    expect(isSelectArg(Select.with({ options: OPTIONS }))).toBe(true);
    expect(isSelectArg(Checkbox)).toBe(false);
    expect(isSelectArg(Metric)).toBe(false);
  });
});

describe('Text', () => {
  test('has expected static defaults', () => {
    expect(Text.controlType).toBe('TextControl');
    expect(Text.default).toBe('');
    expect(Text.placeholder).toBe('');
  });

  test('.with() applies label, default, placeholder', () => {
    const T = Text.with({
      label: 'Title',
      default: 'Untitled',
      placeholder: 'Enter title',
    });
    expect(T.label).toBe('Title');
    expect(T.default).toBe('Untitled');
    expect(T.placeholder).toBe('Enter title');
  });

  test('isTextArg type guard accepts Text but not Select/Checkbox', () => {
    expect(isTextArg(Text)).toBe(true);
    expect(isTextArg(Text.with({ label: 'X' }))).toBe(true);
    expect(isTextArg(Checkbox)).toBe(false);
  });
});

describe('Checkbox', () => {
  test('has expected static defaults', () => {
    expect(Checkbox.controlType).toBe('CheckboxControl');
    expect(Checkbox.default).toBe(false);
  });

  test('.with() applies label, description, default', () => {
    const C = Checkbox.with({
      label: 'Show legend',
      default: true,
    });
    expect(C.label).toBe('Show legend');
    expect(C.default).toBe(true);
  });

  test('isCheckboxArg type guard', () => {
    expect(isCheckboxArg(Checkbox)).toBe(true);
    expect(isCheckboxArg(Checkbox.with({ default: true }))).toBe(true);
    expect(isCheckboxArg(Text)).toBe(false);
  });
});

describe('Int', () => {
  test('has expected static defaults', () => {
    expect(Int.controlType).toBe('SliderControl');
    expect(Int.default).toBe(0);
    expect(Int.min).toBe(0);
    expect(Int.max).toBe(100);
    expect(Int.step).toBe(1);
  });

  test('.with() applies label, default, min, max, step', () => {
    const I = Int.with({
      label: 'Limit',
      default: 50,
      min: 10,
      max: 1000,
      step: 5,
    });
    expect(I.label).toBe('Limit');
    expect(I.default).toBe(50);
    expect(I.min).toBe(10);
    expect(I.max).toBe(1000);
    expect(I.step).toBe(5);
  });

  test('isIntArg type guard', () => {
    expect(isIntArg(Int)).toBe(true);
    expect(isIntArg(Slider)).toBe(true); // Slider also has min/max
    expect(isIntArg(Checkbox)).toBe(false);
  });
});

describe('Color', () => {
  test('has expected static defaults', () => {
    expect(Color.controlType).toBe('ColorPickerControl');
    expect(Color.default).toBe('#000000');
  });

  test('.with() applies label, default', () => {
    const C = Color.with({ label: 'Fill', default: '#ff0000' });
    expect(C.label).toBe('Fill');
    expect(C.default).toBe('#ff0000');
  });

  test('isColorArg type guard', () => {
    expect(isColorArg(Color)).toBe(true);
    expect(isColorArg(Color.with({ default: '#ff0000' }))).toBe(true);
    expect(isColorArg(Metric)).toBe(false);
  });
});

describe('NumberFormat', () => {
  test('has expected static defaults', () => {
    expect(NumberFormat.controlType).toBe('NumberFormatControl');
    expect(NumberFormat.default).toBe('SMART_NUMBER');
    expect(NumberFormat.FORMAT_OPTIONS.length).toBeGreaterThan(10);
    expect(
      NumberFormat.FORMAT_OPTIONS.some(o => o.value === 'SMART_NUMBER'),
    ).toBe(true);
  });

  test('.with() applies label, default', () => {
    const N = NumberFormat.with({ label: 'Amount', default: '.2f' });
    expect(N.label).toBe('Amount');
    expect(N.default).toBe('.2f');
  });

  test('isNumberFormatArg type guard', () => {
    expect(isNumberFormatArg(NumberFormat)).toBe(true);
    expect(isNumberFormatArg(TimeFormat)).toBe(false);
  });
});

describe('Currency', () => {
  test('has expected static defaults', () => {
    expect(Currency.controlType).toBe('CurrencyControl');
    expect(Currency.default).toEqual({});
  });

  test('.with() applies label, default', () => {
    const C = Currency.with({
      label: 'Money',
      default: { symbol: 'USD', symbolPosition: 'prefix' },
    });
    expect(C.label).toBe('Money');
    expect(C.default).toEqual({ symbol: 'USD', symbolPosition: 'prefix' });
  });

  test('isCurrencyArg type guard', () => {
    expect(isCurrencyArg(Currency)).toBe(true);
    expect(isCurrencyArg(NumberFormat)).toBe(false);
  });
});

describe('TimeFormat', () => {
  test('has expected static defaults', () => {
    expect(TimeFormat.controlType).toBe('TimeFormatControl');
    expect(TimeFormat.default).toBe('smart_date');
    expect(
      TimeFormat.FORMAT_OPTIONS.some(o => o.value === 'smart_date'),
    ).toBe(true);
  });

  test('.with() applies label, default', () => {
    const T = TimeFormat.with({ label: 'When', default: '%Y-%m-%d' });
    expect(T.label).toBe('When');
    expect(T.default).toBe('%Y-%m-%d');
  });

  test('isTimeFormatArg type guard', () => {
    expect(isTimeFormatArg(TimeFormat)).toBe(true);
    expect(isTimeFormatArg(NumberFormat)).toBe(false);
  });
});

describe('ConditionalFormatting', () => {
  test('has expected static defaults', () => {
    expect(ConditionalFormatting.controlType).toBe(
      'ConditionalFormattingControl',
    );
    expect(ConditionalFormatting.default).toEqual([]);
  });

  test('.with() applies label and description (not default)', () => {
    const CF = ConditionalFormatting.with({ label: 'Format' });
    expect(CF.label).toBe('Format');
  });

  test('isConditionalFormattingArg type guard', () => {
    expect(isConditionalFormattingArg(ConditionalFormatting)).toBe(true);
    expect(isConditionalFormattingArg(Select)).toBe(false);
  });
});

describe('Slider', () => {
  test('has expected float-friendly defaults', () => {
    expect(Slider.controlType).toBe('SliderControl');
    expect(Slider.default).toBe(0);
    expect(Slider.min).toBe(0);
    expect(Slider.max).toBe(1);
    expect(Slider.step).toBe(0.1);
  });

  test('.with() applies all numeric fields', () => {
    const S = Slider.with({
      label: 'Opacity',
      default: 0.8,
      min: 0,
      max: 1,
      step: 0.05,
    });
    expect(S.label).toBe('Opacity');
    expect(S.default).toBe(0.8);
    expect(S.step).toBe(0.05);
  });

  test('isSliderArg type guard requires float step', () => {
    expect(isSliderArg(Slider)).toBe(true);
    // Int is also SliderControl + has step but step is integer-valued — still
    // numeric so the guard recognizes it (current behavior); document it.
    expect(isSliderArg(Int)).toBe(true);
    expect(isSliderArg(Checkbox)).toBe(false);
  });
});

describe('Bounds', () => {
  test('has expected static defaults', () => {
    expect(Bounds.controlType).toBe('BoundsControl');
    expect(Bounds.default).toEqual([null, null]);
  });

  test('.with() applies default', () => {
    const B = Bounds.with({ label: 'Range', default: [0, 100] });
    expect(B.label).toBe('Range');
    expect(B.default).toEqual([0, 100]);
  });

  test('isBoundsArg type guard', () => {
    expect(isBoundsArg(Bounds)).toBe(true);
    expect(isBoundsArg(Int)).toBe(false);
  });
});

describe('ColorPicker', () => {
  test('has expected static defaults', () => {
    expect(ColorPicker.controlType).toBe('ColorPickerControl');
    expect(ColorPicker.default).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  test('.with() applies default', () => {
    const CP = ColorPicker.with({
      label: 'Pick',
      default: { r: 255, g: 0, b: 0, a: 0.5 },
    });
    expect(CP.label).toBe('Pick');
    expect(CP.default).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
  });

  test('isColorPickerArg distinguishes from Color (string)', () => {
    expect(isColorPickerArg(ColorPicker)).toBe(true);
    expect(isColorPickerArg(Color)).toBe(false);
  });
});

describe('RadioButton', () => {
  const RADIO_OPTIONS = [
    { label: 'Yes', value: true },
    { label: 'No', value: false },
  ];

  test('has expected static defaults', () => {
    expect(RadioButton.controlType).toBe('RadioButtonControl');
    expect(RadioButton.default).toBe('');
    expect(RadioButton.options).toEqual([]);
  });

  test('.with() applies all fields', () => {
    const RB = RadioButton.with({
      label: 'Toggle',
      default: true,
      options: RADIO_OPTIONS,
    });
    expect(RB.label).toBe('Toggle');
    expect(RB.default).toBe(true);
    expect(RB.options).toEqual(RADIO_OPTIONS);
  });

  test('isRadioButtonArg type guard', () => {
    expect(isRadioButtonArg(RadioButton)).toBe(true);
    expect(isRadioButtonArg(Select)).toBe(false);
  });
});

describe('Argument inheritance via .with()', () => {
  test('chained .with() calls compose overrides', () => {
    const Base = Select.with({
      label: 'Pick one',
      options: [{ label: 'A', value: 'a' }],
    });
    const Tighter = Base.with({ label: 'Pick exactly one' });
    expect(Tighter.label).toBe('Pick exactly one');
    expect(Tighter.options).toEqual([{ label: 'A', value: 'a' }]);
  });

  test('original class is unmodified after .with()', () => {
    const before = Metric.multi;
    Metric.with({ multi: !before });
    expect(Metric.multi).toBe(before);
  });
});
