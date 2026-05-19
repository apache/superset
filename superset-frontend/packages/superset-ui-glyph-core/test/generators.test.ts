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
import type { ChartProps } from '@superset-ui/core';
import {
  Checkbox,
  Color,
  createGlyphPlugin,
  Dimension,
  generateControlPanel,
  generateTransformProps,
  getControlConfig,
  Int,
  Metric,
  Select,
  Temporal,
  Text,
} from '@superset-ui/glyph-core';
import type { GlyphArguments } from '@superset-ui/glyph-core/generators';

describe('getControlConfig - per argument type', () => {
  test('Select → SelectControl with options and clearable=false', () => {
    const S = Select.with({
      label: 'Choose',
      default: 'a',
      options: [{ label: 'A', value: 'a' }],
    });
    const cfg = getControlConfig(S, 'myParam');
    expect(cfg.type).toBe('SelectControl');
    expect(cfg.label).toBe('Choose');
    expect(cfg.default).toBe('a');
    expect(cfg.options).toEqual([{ label: 'A', value: 'a' }]);
    expect(cfg.clearable).toBe(false);
    expect(cfg.renderTrigger).toBe(true);
  });

  test('Checkbox → CheckboxControl with default', () => {
    const C = Checkbox.with({ label: 'Show', default: true });
    const cfg = getControlConfig(C, 'show');
    expect(cfg.type).toBe('CheckboxControl');
    expect(cfg.label).toBe('Show');
    expect(cfg.default).toBe(true);
    expect(cfg.renderTrigger).toBe(true);
  });

  test('Int → SliderControl with min/max/step', () => {
    const I = Int.with({ label: 'Limit', default: 50, min: 0, max: 1000, step: 5 });
    const cfg = getControlConfig(I, 'limit');
    expect(cfg.type).toBe('SliderControl');
    expect(cfg.label).toBe('Limit');
    expect(cfg.default).toBe(50);
    expect(cfg.min).toBe(0);
    expect(cfg.max).toBe(1000);
    expect(cfg.step).toBe(5);
  });

  test('Color (hex) → ColorPickerControl with RGBA default', () => {
    const C = Color.with({ label: 'Fill', default: '#ff0000' });
    const cfg = getControlConfig(C, 'fill');
    expect(cfg.type).toBe('ColorPickerControl');
    expect(cfg.label).toBe('Fill');
    expect(cfg.default).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  test('Text → TextControl with placeholder', () => {
    const T = Text.with({
      label: 'Title',
      default: 'Untitled',
      placeholder: 'Enter…',
    });
    const cfg = getControlConfig(T, 'title');
    expect(cfg.type).toBe('TextControl');
    expect(cfg.label).toBe('Title');
    expect(cfg.default).toBe('Untitled');
    expect(cfg.placeholder).toBe('Enter…');
  });

  test('falls back to paramName when label is unset', () => {
    // Use the raw Text class (label: null on Argument)
    class Bare extends Text {
      static override label = null;
    }
    const cfg = getControlConfig(Bare, 'fallback_name');
    expect(cfg.label).toBe('fallback_name');
  });
});

describe('generateControlPanel', () => {
  test('produces Query and Chart Options sections', () => {
    const args: GlyphArguments = new Map([
      ['metric', Metric],
      ['showLegend', Checkbox.with({ label: 'Legend', default: true })],
    ]);
    const cp = generateControlPanel(args);
    const labels = cp.controlPanelSections.map(s =>
      s && 'label' in s ? s.label : undefined,
    );
    expect(labels).toContain('Query');
    expect(labels).toContain('Chart Options');
  });

  test('Metric args produce a [metric] row in Query', () => {
    const args: GlyphArguments = new Map([['m', Metric]]);
    const cp = generateControlPanel(args);
    const querySection = cp.controlPanelSections.find(
      s => s && 'label' in s && s.label === 'Query',
    );
    expect(querySection).toBeDefined();
    const rows = (querySection as { controlSetRows: unknown[][] }).controlSetRows;
    expect(rows).toContainEqual(['metric']);
  });

  test('Dimension args produce a [groupby] row in Query', () => {
    const args: GlyphArguments = new Map([['d', Dimension]]);
    const cp = generateControlPanel(args);
    const querySection = cp.controlPanelSections.find(
      s => s && 'label' in s && s.label === 'Query',
    );
    const rows = (querySection as { controlSetRows: unknown[][] }).controlSetRows;
    expect(rows).toContainEqual(['groupby']);
  });

  test('Temporal args produce [x_axis] and [time_grain_sqla] rows in Query', () => {
    const args: GlyphArguments = new Map([['t', Temporal]]);
    const cp = generateControlPanel(args);
    const querySection = cp.controlPanelSections.find(
      s => s && 'label' in s && s.label === 'Query',
    );
    const rows = (querySection as { controlSetRows: unknown[][] }).controlSetRows;
    expect(rows).toContainEqual(['x_axis']);
    expect(rows).toContainEqual(['time_grain_sqla']);
  });

  test('adhoc_filters is always added to Query', () => {
    const args: GlyphArguments = new Map();
    const cp = generateControlPanel(args);
    const querySection = cp.controlPanelSections.find(
      s => s && 'label' in s && s.label === 'Query',
    );
    const rows = (querySection as { controlSetRows: unknown[][] }).controlSetRows;
    expect(rows).toContainEqual(['adhoc_filters']);
  });

  test('Non-data args become controls in Chart Options', () => {
    const args: GlyphArguments = new Map([
      ['showLegend', Checkbox.with({ label: 'Legend', default: true })],
    ]);
    const cp = generateControlPanel(args);
    const chartOpts = cp.controlPanelSections.find(
      s => s && 'label' in s && s.label === 'Chart Options',
    );
    const rows = (chartOpts as { controlSetRows: unknown[][] }).controlSetRows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual([
      {
        name: 'showLegend',
        config: expect.objectContaining({ type: 'CheckboxControl' }),
      },
    ]);
  });

  test('GlyphArgConfig with visibility wires onto control', () => {
    const visibility = jest.fn(() => true);
    const args: GlyphArguments = new Map([
      [
        'subtitleSize',
        {
          arg: Select.with({
            label: 'Size',
            default: 'm',
            options: [{ label: 'M', value: 'm' }],
          }),
          visibility,
          resetOnHide: true,
        },
      ],
    ]);
    const cp = generateControlPanel(args);
    const chartOpts = cp.controlPanelSections.find(
      s => s && 'label' in s && s.label === 'Chart Options',
    );
    const row = (chartOpts as { controlSetRows: unknown[][] }).controlSetRows[0];
    const item = (row as Array<{ config: Record<string, unknown> }>)[0];
    expect(item.config.visibility).toBe(visibility);
    expect(item.config.resetOnHide).toBe(true);
  });

  test('controlOverrides and formDataOverrides options pass through', () => {
    const fdo = (fd: Record<string, unknown>) => ({ ...fd, x: 1 });
    const cp = generateControlPanel(new Map(), {
      controlOverrides: { metric: { label: 'M' } },
      formDataOverrides: fdo,
    });
    expect(cp.controlOverrides).toEqual({ metric: { label: 'M' } });
    expect(cp.formDataOverrides).toBe(fdo);
  });

  test('extra queryControls and chartOptionsControls are appended', () => {
    const args: GlyphArguments = new Map();
    const cp = generateControlPanel(args, {
      queryControls: [['custom_filter']] as never,
      chartOptionsControls: [['custom_chart_opt']] as never,
    });
    const querySection = cp.controlPanelSections.find(
      s => s && 'label' in s && s.label === 'Query',
    );
    const queryRows = (querySection as { controlSetRows: unknown[][] })
      .controlSetRows;
    expect(queryRows).toContainEqual(['custom_filter']);

    const chartOpts = cp.controlPanelSections.find(
      s => s && 'label' in s && s.label === 'Chart Options',
    );
    const optRows = (chartOpts as { controlSetRows: unknown[][] }).controlSetRows;
    expect(optRows).toContainEqual(['custom_chart_opt']);
  });
});

describe('generateTransformProps', () => {
  function makeChartProps(formData: Record<string, unknown>): ChartProps {
    return {
      width: 400,
      height: 300,
      queriesData: [{ data: [] }],
      formData,
    } as unknown as ChartProps;
  }

  test('returns width/height/queriesData passthrough', () => {
    const transform = generateTransformProps(new Map());
    const out = transform(makeChartProps({}));
    expect(out).toMatchObject({ width: 400, height: 300 });
  });

  test('extracts Select value from formData', () => {
    const args: GlyphArguments = new Map([
      [
        'size',
        Select.with({
          label: 'Size',
          default: 'm',
          options: [
            { label: 'S', value: 's' },
            { label: 'M', value: 'm' },
          ],
        }),
      ],
    ]);
    const transform = generateTransformProps(args);
    const out = transform(makeChartProps({ size: 's' }));
    expect((out as { size: unknown }).size).toBe('s');
  });

  test('Select falls back to default when value missing', () => {
    const args: GlyphArguments = new Map([
      ['size', Select.with({ label: 'Size', default: 'm', options: [] })],
    ]);
    const transform = generateTransformProps(args);
    const out = transform(makeChartProps({}));
    expect((out as { size: unknown }).size).toBe('m');
  });

  test('Checkbox uses formData value when present', () => {
    const args: GlyphArguments = new Map([
      ['flag', Checkbox.with({ label: 'F', default: false })],
    ]);
    const transform = generateTransformProps(args);
    const out = transform(makeChartProps({ flag: true }));
    expect((out as { flag: unknown }).flag).toBe(true);
  });

  test('Checkbox falls back to default when value missing', () => {
    const args: GlyphArguments = new Map([
      ['flag', Checkbox.with({ label: 'F', default: true })],
    ]);
    const transform = generateTransformProps(args);
    const out = transform(makeChartProps({}));
    expect((out as { flag: unknown }).flag).toBe(true);
  });

  test('Color: RGBA in formData → hex string', () => {
    const args: GlyphArguments = new Map([
      ['fill', Color.with({ label: 'Fill', default: '#000000' })],
    ]);
    const transform = generateTransformProps(args);
    const out = transform(
      makeChartProps({ fill: { r: 255, g: 0, b: 0, a: 1 } }),
    );
    expect((out as { fill: unknown }).fill).toBe('#ff0000');
  });

  test('Color: string value in formData passes through', () => {
    const args: GlyphArguments = new Map([
      ['fill', Color.with({ label: 'Fill', default: '#000000' })],
    ]);
    const transform = generateTransformProps(args);
    const out = transform(makeChartProps({ fill: '#abcdef' }));
    expect((out as { fill: unknown }).fill).toBe('#abcdef');
  });

  test('Color: falls back to class default when value missing', () => {
    const args: GlyphArguments = new Map([
      ['fill', Color.with({ label: 'Fill', default: '#112233' })],
    ]);
    const transform = generateTransformProps(args);
    const out = transform(makeChartProps({}));
    // default is hex string; transform converts the RGBA-formatted default back to hex
    expect((out as { fill: unknown }).fill).toBe('#112233');
  });

  test('Int uses default when value missing', () => {
    const args: GlyphArguments = new Map([
      ['n', Int.with({ label: 'N', default: 7, min: 0, max: 100 })],
    ]);
    const transform = generateTransformProps(args);
    const out = transform(makeChartProps({}));
    expect((out as { n: unknown }).n).toBe(7);
  });

  test('Text uses default when value missing', () => {
    const args: GlyphArguments = new Map([
      ['s', Text.with({ label: 'S', default: 'hi' })],
    ]);
    const transform = generateTransformProps(args);
    const out = transform(makeChartProps({}));
    expect((out as { s: unknown }).s).toBe('hi');
  });

  test('Metric/Dimension/Temporal args are NOT extracted (handled elsewhere)', () => {
    const args: GlyphArguments = new Map([
      ['metric', Metric],
      ['groupby', Dimension],
      ['t', Temporal],
    ]);
    const transform = generateTransformProps(args);
    const out = transform(
      makeChartProps({ metric: 'count', groupby: 'a', t: 'date' }),
    );
    expect((out as Record<string, unknown>).metric).toBeUndefined();
    expect((out as Record<string, unknown>).groupby).toBeUndefined();
    expect((out as Record<string, unknown>).t).toBeUndefined();
  });

  test('passthrough option copies named ChartProps fields onto the result', () => {
    const args: GlyphArguments = new Map();
    const transform = generateTransformProps(args, {
      passthrough: ['formData'],
    });
    const out = transform(makeChartProps({ marker: 1 })) as Record<
      string,
      unknown
    >;
    expect(out.formData).toEqual({ marker: 1 });
  });

  test('custom transform option receives extracted values and chartProps', () => {
    const args: GlyphArguments = new Map([
      ['flag', Checkbox.with({ label: 'F', default: false })],
    ]);
    const transform = generateTransformProps(args, {
      transform: (values, chartProps) => ({
        values,
        gotChartProps: !!chartProps,
      }),
    });
    const out = transform(makeChartProps({ flag: true })) as {
      values: { flag: boolean };
      gotChartProps: boolean;
    };
    expect(out.values.flag).toBe(true);
    expect(out.gotChartProps).toBe(true);
  });
});

describe('createGlyphPlugin', () => {
  test('returns both controlPanel and transformProps', () => {
    const args: GlyphArguments = new Map([
      ['metric', Metric],
      ['show', Checkbox.with({ label: 'S', default: true })],
    ]);
    const plugin = createGlyphPlugin(args);
    expect(plugin.controlPanel).toBeDefined();
    expect(plugin.controlPanel.controlPanelSections.length).toBe(2);
    expect(typeof plugin.transformProps).toBe('function');
  });
});
