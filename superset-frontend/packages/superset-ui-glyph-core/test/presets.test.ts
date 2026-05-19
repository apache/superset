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
  Checkbox,
  CircleShape,
  DataZoom,
  ForceTimestampFormatting,
  HeaderFontSize,
  isCheckboxArg,
  isSelectArg,
  isTextArg,
  LabelPosition,
  LabelType,
  LabelThreshold,
  LegendOrientation,
  LegendSort,
  LegendType,
  MetricNameFontSize,
  Select,
  ShowLabels,
  ShowLegend,
  ShowMetricName,
  ShowTotal,
  ShowValue,
  SimpleLabelType,
  SortByMetric,
  Subtitle,
  SubheaderFontSize,
  Text,
  ValueLabelType,
} from '@superset-ui/glyph-core';
import {
  FONT_SIZE_OPTIONS_LARGE,
  FONT_SIZE_OPTIONS_SMALL,
  LABEL_TYPE_OPTIONS,
  LEGEND_ORIENTATION_OPTIONS,
  LEGEND_SORT_OPTIONS,
  LEGEND_TYPE_OPTIONS,
  SORT_OPTIONS,
} from '@superset-ui/glyph-core/presets';

describe('Font-size presets', () => {
  test('HeaderFontSize is a Select with large font options', () => {
    expect(isSelectArg(HeaderFontSize)).toBe(true);
    expect((HeaderFontSize as unknown as typeof Select).options).toBe(
      FONT_SIZE_OPTIONS_LARGE,
    );
  });

  test('SubheaderFontSize is a Select with small font options', () => {
    expect(isSelectArg(SubheaderFontSize)).toBe(true);
    expect((SubheaderFontSize as unknown as typeof Select).options).toBe(
      FONT_SIZE_OPTIONS_SMALL,
    );
  });

  test('FONT_SIZE_OPTIONS_LARGE and _SMALL are non-empty option arrays', () => {
    expect(FONT_SIZE_OPTIONS_LARGE.length).toBeGreaterThan(0);
    expect(FONT_SIZE_OPTIONS_SMALL.length).toBeGreaterThan(0);
    expect(FONT_SIZE_OPTIONS_LARGE[0]).toHaveProperty('label');
    expect(FONT_SIZE_OPTIONS_LARGE[0]).toHaveProperty('value');
  });

  test('MetricNameFontSize is a Select preset', () => {
    expect(isSelectArg(MetricNameFontSize)).toBe(true);
  });
});

describe('Text presets', () => {
  test('Subtitle is a Text preset', () => {
    expect(isTextArg(Subtitle)).toBe(true);
    expect(Subtitle.prototype).toBeInstanceOf(Text);
  });

  test('LabelThreshold is a Text preset', () => {
    expect(isTextArg(LabelThreshold)).toBe(true);
  });
});

describe('Checkbox presets', () => {
  test.each([
    ['ShowLegend', ShowLegend],
    ['ShowLabels', ShowLabels],
    ['ShowValue', ShowValue],
    ['ShowMetricName', ShowMetricName],
    ['ShowTotal', ShowTotal],
    ['SortByMetric', SortByMetric],
    ['CircleShape', CircleShape],
    ['DataZoom', DataZoom],
    ['ForceTimestampFormatting', ForceTimestampFormatting],
  ])('%s is a Checkbox preset', (_name, preset) => {
    expect(isCheckboxArg(preset)).toBe(true);
    expect(preset.prototype).toBeInstanceOf(Checkbox);
  });

  test('Checkbox presets have a label and a description', () => {
    [ShowLegend, ShowLabels, ShowValue, ShowMetricName, ShowTotal].forEach(
      preset => {
        expect(preset.label).toBeTruthy();
        expect(preset.description).toBeTruthy();
      },
    );
  });
});

describe('Legend Select presets', () => {
  test('LegendType uses LEGEND_TYPE_OPTIONS', () => {
    expect(isSelectArg(LegendType)).toBe(true);
    expect((LegendType as unknown as typeof Select).options).toBe(
      LEGEND_TYPE_OPTIONS,
    );
  });

  test('LegendOrientation uses LEGEND_ORIENTATION_OPTIONS', () => {
    expect(isSelectArg(LegendOrientation)).toBe(true);
    expect((LegendOrientation as unknown as typeof Select).options).toBe(
      LEGEND_ORIENTATION_OPTIONS,
    );
  });

  test('LegendSort uses LEGEND_SORT_OPTIONS', () => {
    expect(isSelectArg(LegendSort)).toBe(true);
    expect((LegendSort as unknown as typeof Select).options).toBe(
      LEGEND_SORT_OPTIONS,
    );
  });

  test('legend option sets are non-empty', () => {
    expect(LEGEND_TYPE_OPTIONS.length).toBeGreaterThan(0);
    expect(LEGEND_ORIENTATION_OPTIONS.length).toBeGreaterThan(0);
    expect(LEGEND_SORT_OPTIONS.length).toBeGreaterThan(0);
  });
});

describe('Label / value-label Select presets', () => {
  test('LabelType is a Select with LABEL_TYPE_OPTIONS', () => {
    expect(isSelectArg(LabelType)).toBe(true);
    expect((LabelType as unknown as typeof Select).options).toBe(
      LABEL_TYPE_OPTIONS,
    );
  });

  test('SimpleLabelType is a Select preset', () => {
    expect(isSelectArg(SimpleLabelType)).toBe(true);
  });

  test('ValueLabelType is a Select preset', () => {
    expect(isSelectArg(ValueLabelType)).toBe(true);
  });

  test('LabelPosition is a Select preset', () => {
    expect(isSelectArg(LabelPosition)).toBe(true);
  });
});

describe('Sort options', () => {
  test('SORT_OPTIONS is non-empty', () => {
    expect(SORT_OPTIONS.length).toBeGreaterThan(0);
    expect(SORT_OPTIONS[0]).toHaveProperty('label');
    expect(SORT_OPTIONS[0]).toHaveProperty('value');
  });
});

describe('Preset extensibility', () => {
  test('ShowLegend.with() overrides label while keeping the Checkbox shape', () => {
    const Custom = ShowLegend.with({
      label: 'Display legend',
      default: false,
    });
    expect(isCheckboxArg(Custom)).toBe(true);
    expect(Custom.label).toBe('Display legend');
    expect(Custom.default).toBe(false);
  });

  test('HeaderFontSize.with() overrides label, default keeps options', () => {
    const Custom = HeaderFontSize.with({
      label: 'Title size',
      default: 0.4,
    });
    expect(isSelectArg(Custom)).toBe(true);
    expect(Custom.label).toBe('Title size');
    expect(Custom.default).toBe(0.4);
    expect((Custom as unknown as typeof Select).options).toBe(
      FONT_SIZE_OPTIONS_LARGE,
    );
  });
});
