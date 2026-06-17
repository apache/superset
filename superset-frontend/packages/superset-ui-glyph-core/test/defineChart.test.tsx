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
  Behavior,
  ChartLabel,
  ChartMetadata,
  ChartPlugin,
} from '@superset-ui/core';
import {
  Bounds,
  Checkbox,
  ColorPicker,
  defineChart,
  Dimension,
  evaluateGlyphCondition,
  getArgVisibleWhen,
  getGlyphControlConfig,
  Metric,
  RadioButton,
  resolveArgClass,
  Select,
  Temporal,
  Text,
} from '@superset-ui/glyph-core';
import type { ChartDefinition } from '@superset-ui/glyph-core/defineChart';

// Helper: instantiate a plugin and reach its controlPanel config.
function instantiate(PluginClass: ReturnType<typeof defineChart>) {
  const plugin = new PluginClass();
  // ChartPlugin internals expose the panel under .controlPanel
  // (set via super({ controlPanel }) in defineChart's GlyphChartPlugin).
  return {
    plugin,
    controlPanel: (
      plugin as unknown as { controlPanel: Record<string, unknown> }
    ).controlPanel,
    metadata: (plugin as unknown as { metadata: ChartMetadata }).metadata,
  };
}

const MIN_THUMBNAIL = 'thumb.png';

describe('resolveArgClass', () => {
  test('returns the bare class form unchanged', () => {
    expect(resolveArgClass(Metric)).toBe(Metric);
  });

  test('unwraps the { arg, visibleWhen } object form', () => {
    const M = Metric.with({ label: 'Sales' });
    const argDef = { arg: M, visibleWhen: { show: true } };
    expect(resolveArgClass(argDef)).toBe(M);
  });
});

describe('getArgVisibleWhen', () => {
  test('returns undefined for bare class form', () => {
    expect(getArgVisibleWhen(Metric)).toBeUndefined();
  });

  test('returns the condition for object form', () => {
    const argDef = { arg: Metric, visibleWhen: { show: true } };
    expect(getArgVisibleWhen(argDef)).toEqual({ show: true });
  });

  test('returns undefined when object form has no visibleWhen', () => {
    expect(getArgVisibleWhen({ arg: Metric })).toBeUndefined();
  });
});

describe('evaluateGlyphCondition', () => {
  test('returns true for empty condition', () => {
    expect(evaluateGlyphCondition({}, { foo: 1 })).toBe(true);
  });

  test('returns true when equality check matches', () => {
    expect(evaluateGlyphCondition({ show: true }, { show: true })).toBe(true);
  });

  test('returns false when equality check fails', () => {
    expect(evaluateGlyphCondition({ show: true }, { show: false })).toBe(false);
  });

  test('handles missing formData keys as undefined', () => {
    expect(evaluateGlyphCondition({ show: true }, {})).toBe(false);
  });

  test('supports function-valued conditions', () => {
    const cond = { subtitle: (val: unknown) => !!val };
    expect(evaluateGlyphCondition(cond, { subtitle: 'hi' })).toBe(true);
    expect(evaluateGlyphCondition(cond, { subtitle: '' })).toBe(false);
  });

  test('requires all keys in the condition to pass (AND semantics)', () => {
    const cond = { a: true, b: 'x' };
    expect(evaluateGlyphCondition(cond, { a: true, b: 'x' })).toBe(true);
    expect(evaluateGlyphCondition(cond, { a: true, b: 'y' })).toBe(false);
    expect(evaluateGlyphCondition(cond, { a: false, b: 'x' })).toBe(false);
  });
});

describe('defineChart - basic plugin construction', () => {
  test('returns a ChartPlugin subclass', () => {
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: {},
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });

    const p = new Plugin();
    expect(p).toBeInstanceOf(ChartPlugin);
  });

  test('plugin metadata is a ChartMetadata instance with required fields', () => {
    const Plugin = defineChart({
      metadata: {
        name: 'Test',
        description: 'A test chart',
        category: 'Charts',
        tags: ['test'],
        thumbnail: MIN_THUMBNAIL,
      },
      arguments: {},
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });

    const { metadata } = instantiate(Plugin);
    expect(metadata).toBeInstanceOf(ChartMetadata);
    expect(metadata.name).toBe('Test');
    expect(metadata.description).toBe('A test chart');
    expect(metadata.category).toBe('Charts');
    expect(metadata.tags).toEqual(['test']);
    expect(metadata.thumbnail).toBe(MIN_THUMBNAIL);
  });

  test('metadata defaults behaviors to [] when omitted (matching ChartMetadata)', () => {
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: {},
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { metadata } = instantiate(Plugin);
    // Charts must opt in to InteractiveChart — defaulting it on would enroll
    // non-interactive charts in dashboard cross-filter UI and configuration.
    expect(metadata.behaviors).toEqual([]);
  });

  test('metadata forwards queryObjectCount and related fields', () => {
    const Plugin = defineChart({
      metadata: {
        name: 'Test',
        thumbnail: MIN_THUMBNAIL,
        queryObjectCount: 2,
        suppressContextMenu: true,
        enableNoResults: false,
      },
      arguments: {},
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { metadata } = instantiate(Plugin);
    expect(metadata.queryObjectCount).toBe(2);
    expect(metadata.suppressContextMenu).toBe(true);
    expect(metadata.enableNoResults).toBe(false);
  });

  test('metadata behaviors override the default when provided', () => {
    const Plugin = defineChart({
      metadata: {
        name: 'Test',
        thumbnail: MIN_THUMBNAIL,
        behaviors: [Behavior.InteractiveChart, Behavior.DrillToDetail],
      },
      arguments: {},
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { metadata } = instantiate(Plugin);
    expect(metadata.behaviors).toEqual([
      Behavior.InteractiveChart,
      Behavior.DrillToDetail,
    ]);
  });

  test('passes label, canBeAnnotationTypes, useLegacyApi, supportedAnnotationTypes through', () => {
    const Plugin = defineChart({
      metadata: {
        name: 'Test',
        thumbnail: MIN_THUMBNAIL,
        label: ChartLabel.Deprecated,
        canBeAnnotationTypes: ['EVENT', 'INTERVAL'],
        useLegacyApi: true,
        supportedAnnotationTypes: ['FORMULA'],
        credits: ['https://example.com'],
      },
      arguments: {},
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { metadata } = instantiate(Plugin);
    expect(metadata.label).toBe(ChartLabel.Deprecated);
    expect(metadata.canBeAnnotationTypes).toEqual(['EVENT', 'INTERVAL']);
    expect(metadata.useLegacyApi).toBe(true);
    expect(metadata.supportedAnnotationTypes).toEqual(['FORMULA']);
    expect(metadata.credits).toEqual(['https://example.com']);
  });

  test('exampleGallery + thumbnailDark are preserved', () => {
    const Plugin = defineChart({
      metadata: {
        name: 'Test',
        thumbnail: MIN_THUMBNAIL,
        thumbnailDark: 'thumb-dark.png',
        exampleGallery: [{ url: 'a.png', urlDark: 'a-dark.png' }],
      },
      arguments: {},
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { metadata } = instantiate(Plugin);
    expect(metadata.thumbnailDark).toBe('thumb-dark.png');
    expect(metadata.exampleGallery).toEqual([
      { url: 'a.png', urlDark: 'a-dark.png' },
    ]);
  });
});

describe('defineChart - controlPanel generation from arguments', () => {
  test('Query section is auto-generated from Metric/Dimension arguments', () => {
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: {
        metric: Metric,
        groupby: Dimension,
      },
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    const sections = controlPanel.controlPanelSections as Array<{
      label?: string;
    }>;
    // Query section should be auto-generated
    expect(sections.some(s => s?.label === 'Query')).toBe(true);
  });

  test('suppressQuerySection: true skips the auto Query section', () => {
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: {
        metric: Metric,
      },
      suppressQuerySection: true,
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    const sections = controlPanel.controlPanelSections as Array<{
      label?: string;
    }>;
    // The auto-generated Query section is suppressed.
    // (Charts using suppressQuerySection typically provide their own via
    // prependSections — see legacy nvd3 / deckgl consolidations.)
    const autoQuery = sections.find(s => s?.label === 'Query');
    expect(autoQuery).toBeUndefined();
  });

  test('Chart Options section is generated when there are non-data args', () => {
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: {
        metric: Metric,
        showLegend: Checkbox.with({ label: 'Show legend', default: true }),
      },
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    const sections = controlPanel.controlPanelSections as Array<{
      label?: string;
    }>;
    expect(sections.some(s => s?.label === 'Chart Options')).toBe(true);
  });

  test('Chart Options section is hidden when there are no customize args', () => {
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: {
        metric: Metric,
        groupby: Dimension,
      },
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    const sections = controlPanel.controlPanelSections as Array<{
      label?: string;
    }>;
    // No Customize-tab content → Chart Options auto-hides.
    expect(sections.some(s => s?.label === 'Chart Options')).toBe(false);
  });
});

describe('defineChart - prependSections / middleSections / additionalSections', () => {
  test('prependSections appears before the auto Query section', () => {
    const TIME_SECTION = {
      label: 'Time',
      controlSetRows: [],
    };
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: { metric: Metric },
      prependSections: [TIME_SECTION],
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    const sections = controlPanel.controlPanelSections as Array<{
      label?: string;
    }>;
    const timeIdx = sections.findIndex(s => s?.label === 'Time');
    const queryIdx = sections.findIndex(s => s?.label === 'Query');
    expect(timeIdx).toBeGreaterThanOrEqual(0);
    expect(queryIdx).toBeGreaterThan(timeIdx);
  });

  test('additionalSections appears after Chart Options', () => {
    const TIME_COMP = {
      label: 'Time Comparison',
      controlSetRows: [],
    };
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: {
        metric: Metric,
        showLegend: Checkbox.with({ label: 'Show', default: true }),
      },
      additionalSections: [TIME_COMP],
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    const sections = controlPanel.controlPanelSections as Array<{
      label?: string;
    }>;
    const chartOptsIdx = sections.findIndex(s => s?.label === 'Chart Options');
    const timeCompIdx = sections.findIndex(s => s?.label === 'Time Comparison');
    expect(chartOptsIdx).toBeGreaterThanOrEqual(0);
    expect(timeCompIdx).toBeGreaterThan(chartOptsIdx);
  });

  test('middleSections appears between Query and Chart Options', () => {
    const MIDDLE = {
      label: 'Middle',
      controlSetRows: [],
    };
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: {
        metric: Metric,
        showLegend: Checkbox.with({ label: 'Show', default: true }),
      },
      middleSections: [MIDDLE],
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    const sections = controlPanel.controlPanelSections as Array<{
      label?: string;
    }>;
    const queryIdx = sections.findIndex(s => s?.label === 'Query');
    const middleIdx = sections.findIndex(s => s?.label === 'Middle');
    const chartOptsIdx = sections.findIndex(s => s?.label === 'Chart Options');
    expect(queryIdx).toBeLessThan(middleIdx);
    expect(middleIdx).toBeLessThan(chartOptsIdx);
  });

  test('chartOptionsTabOverride sets tabOverride on the generated section', () => {
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: {
        showLegend: Checkbox.with({ label: 'Show', default: true }),
      },
      chartOptionsTabOverride: 'data',
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    const sections = controlPanel.controlPanelSections as Array<{
      label?: string;
      tabOverride?: string;
    }>;
    const chartOpts = sections.find(s => s?.label === 'Chart Options');
    expect(chartOpts?.tabOverride).toBe('data');
  });
});

describe('defineChart - overrides + formDataOverrides + onInit', () => {
  test('additionalControlOverrides land on controlPanel.controlOverrides', () => {
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: { metric: Metric },
      additionalControlOverrides: {
        size: { label: 'Custom Size Label' },
      },
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    expect(
      (controlPanel.controlOverrides as Record<string, unknown>)?.size,
    ).toEqual({ label: 'Custom Size Label' });
  });

  test('controlOverrides + additionalControlOverrides merge', () => {
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: { metric: Metric },
      controlOverrides: {
        a: { label: 'A' },
      },
      additionalControlOverrides: {
        b: { label: 'B' },
      },
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    const merged = controlPanel.controlOverrides as Record<string, unknown>;
    expect(merged.a).toEqual({ label: 'A' });
    expect(merged.b).toEqual({ label: 'B' });
  });

  test('formDataOverrides is preserved on controlPanel', () => {
    const fdo = ((formData: Record<string, unknown>) => ({
      ...formData,
      custom: 'extra',
    })) as unknown as ChartDefinition<
      Record<string, never>
    >['formDataOverrides'];
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: {},
      formDataOverrides: fdo,
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    expect(controlPanel.formDataOverrides).toBe(fdo);
  });

  test('onInit is preserved on controlPanel', () => {
    const onInit = (state: unknown) => state;
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: {},
      onInit,
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    expect(controlPanel.onInit).toBe(onInit);
  });

  test('_glyphArgs is attached to the controlPanel for native rendering', () => {
    const args = {
      metric: Metric,
      showLegend: Checkbox.with({ label: 'Show', default: true }),
    };
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: args,
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    expect(controlPanel._glyphArgs).toEqual(args);
  });
});

describe('defineChart - custom buildQuery / transform', () => {
  test('custom buildQuery is invoked via the plugin loader', async () => {
    const customBuildQuery = jest.fn(() => ({ queries: [{ marker: 1 }] }));
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: {},
      buildQuery: customBuildQuery as unknown as never,
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const p = new Plugin();
    // ChartPlugin stores it as a sanitized loader
    const loader = (
      p as unknown as { loadBuildQuery?: () => Promise<Function> }
    ).loadBuildQuery;
    expect(loader).toBeDefined();
    const fn = await (loader as () => Promise<Function>)();
    fn({ viz_type: 'test', datasource: '1__table' });
    expect(customBuildQuery).toHaveBeenCalledTimes(1);
  });

  test('transform receives chartProps and argValues', async () => {
    const captured: unknown[] = [];
    const Plugin = defineChart({
      metadata: { name: 'Test', thumbnail: MIN_THUMBNAIL },
      arguments: { metric: Metric },
      transform: (chartProps, argValues) => {
        captured.push({ chartProps, argValues });
        return { transformed: true };
      },
      render: () => null as unknown as React.ReactElement,
    });
    const p = new Plugin();
    const loader = (
      p as unknown as { loadTransformProps: () => Promise<Function> }
    ).loadTransformProps;
    const transformProps = await loader();
    transformProps({
      width: 100,
      height: 100,
      formData: { metric: 'count' },
      queriesData: [{ data: [] }],
    });
    expect(captured).toHaveLength(1);
    expect((captured[0] as { chartProps: unknown }).chartProps).toBeDefined();
    expect((captured[0] as { argValues: unknown }).argValues).toBeDefined();
  });
});

describe('defineChart - Text-only argument behavior', () => {
  test('a Text-only chart still wires up a working plugin', () => {
    const Plugin = defineChart({
      metadata: { name: 'TextOnly', thumbnail: MIN_THUMBNAIL },
      arguments: {
        title: Text.with({ label: 'Title', default: 'Hi' }),
      },
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel, metadata } = instantiate(Plugin);
    expect(metadata.name).toBe('TextOnly');
    // Customize args present → Chart Options shows up
    const sections = controlPanel.controlPanelSections as Array<{
      label?: string;
    }>;
    expect(sections.some(s => s?.label === 'Chart Options')).toBe(true);
  });
});

describe('defineChart - visibleWhen with object-form ArgDef', () => {
  test('attaches a visibility derivation to the underlying control', () => {
    // Build a plugin where one arg is visibleWhen another is true.
    const Plugin = defineChart({
      metadata: { name: 'V', thumbnail: MIN_THUMBNAIL },
      arguments: {
        showLegend: Checkbox.with({ label: 'Show legend', default: true }),
        legendPosition: {
          arg: Select.with({
            label: 'Position',
            default: 'right',
            options: [{ label: 'R', value: 'right' }],
          }),
          visibleWhen: { showLegend: true },
        },
      },
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    expect(controlPanel._glyphArgs).toBeDefined();
    const glyphArgs = controlPanel._glyphArgs as Record<string, unknown>;
    // The visibleWhen is preserved on the glyph args
    const lp = glyphArgs.legendPosition as { visibleWhen?: unknown };
    expect(lp.visibleWhen).toEqual({ showLegend: true });
  });
});

describe('defineChart - getGlyphControlConfig argument class coverage', () => {
  test('RadioButton maps to RadioButtonControl (not SelectControl)', () => {
    const Choice = RadioButton.with({
      label: 'Mode',
      default: 'a',
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
    });
    const config = getGlyphControlConfig(Choice, 'mode');
    expect(config.type).toBe('RadioButtonControl');
    expect(config.default).toBe('a');
    expect(config.options).toEqual([
      ['a', 'A'],
      ['b', 'B'],
    ]);
  });

  test('ColorPicker keeps its RGBA object default (no hex coercion)', () => {
    const red = { r: 255, g: 0, b: 0, a: 1 };
    const Picker = ColorPicker.with({ label: 'Stroke', default: red });
    const config = getGlyphControlConfig(Picker, 'stroke');
    expect(config.type).toBe('ColorPickerControl');
    expect(config.default).toEqual(red);
  });

  test('Bounds maps to BoundsControl (not TextControl)', () => {
    const Range = Bounds.with({ label: 'Y bounds', default: [0, 100] });
    const config = getGlyphControlConfig(Range, 'y_bounds');
    expect(config.type).toBe('BoundsControl');
    expect(config.default).toEqual([0, 100]);
  });

  test('Select honors clearable from the argument class', () => {
    const config = getGlyphControlConfig(
      Select.with({ label: 'S', options: [{ label: 'A', value: 'a' }] }),
      's',
    );
    expect(config.clearable).toBe(false);
  });
});

describe('defineChart - disabledWhen wiring', () => {
  test('mapStateToProps reads controls from the state (first) argument', () => {
    const Plugin = defineChart({
      metadata: { name: 'D', thumbnail: MIN_THUMBNAIL },
      arguments: {
        subtitle: Text.with({ label: 'Subtitle', default: '' }),
        subtitleFontSize: {
          arg: Select.with({
            label: 'Size',
            default: 'm',
            options: [{ label: 'M', value: 'm' }],
          }),
          disabledWhen: { subtitle: (val: unknown) => !val },
        },
      },
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    const sections = controlPanel.controlPanelSections as Array<{
      controlSetRows: Array<
        Array<{ name: string; config: Record<string, Function> }>
      >;
    }>;
    const control = sections
      .flatMap(s => s.controlSetRows)
      .flat()
      .find(c => c?.name === 'subtitleFontSize');
    expect(control).toBeDefined();
    const { mapStateToProps, shouldMapStateToProps } = control!.config;
    expect(shouldMapStateToProps()).toBe(true);

    // Both real call sites pass the controls-bearing state as the FIRST arg
    const disabledResult = mapStateToProps(
      { controls: { subtitle: { value: '' } } },
      { value: 'm' },
    );
    expect(disabledResult.disabled).toBe(true);

    const enabledResult = mapStateToProps(
      { controls: { subtitle: { value: 'hello' } } },
      { value: 'm' },
    );
    expect(enabledResult.disabled).toBe(false);
  });
});

describe('defineChart - generated buildQuery temporal axis', () => {
  test('x_axis column is normalized to BASE_AXIS with timeGrain', async () => {
    const Plugin = defineChart({
      metadata: { name: 'T', thumbnail: MIN_THUMBNAIL },
      arguments: { time: Temporal, metric: Metric },
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const p = new Plugin();
    const loader = (p as unknown as { loadBuildQuery: () => Promise<Function> })
      .loadBuildQuery;
    const buildQuery = await loader();
    const queryContext = buildQuery({
      datasource: '1__table',
      viz_type: 'test',
      x_axis: 'ds',
      time_grain_sqla: 'P1D',
      metrics: ['count'],
    });
    const axisColumn = queryContext.queries[0].columns.find(
      (col: { columnType?: string }) =>
        typeof col === 'object' && col?.columnType === 'BASE_AXIS',
    );
    expect(axisColumn).toBeDefined();
    expect(axisColumn.sqlExpression).toBe('ds');
    // The grain selected in the control panel must reach the query
    expect(axisColumn.timeGrain).toBe('P1D');
  });
});

describe('defineChart - generated metric extraction', () => {
  async function getTransformProps(
    PluginClass: ReturnType<typeof defineChart>,
  ) {
    const p = new PluginClass();
    const loader = (
      p as unknown as { loadTransformProps: () => Promise<Function> }
    ).loadTransformProps;
    return loader();
  }

  const MetricPlugin = defineChart({
    metadata: { name: 'M', thumbnail: MIN_THUMBNAIL },
    arguments: { metric: Metric },
    render: () => null as unknown as React.ReactElement,
  });

  test('label-less SQL adhoc metrics resolve via sqlExpression', async () => {
    const transformProps = await getTransformProps(MetricPlugin);
    const props = transformProps({
      width: 1,
      height: 1,
      formData: {
        metric: { expressionType: 'SQL', sqlExpression: 'SUM(x)/SUM(y)' },
      },
      queriesData: [{ data: [{ 'SUM(x)/SUM(y)': 42 }] }],
    });
    expect(props.metric.name).toBe('SUM(x)/SUM(y)');
    expect(props.metric.value).toBe(42);
  });

  test('does NOT guess among multiple numeric columns on label miss', async () => {
    const transformProps = await getTransformProps(MetricPlugin);
    const props = transformProps({
      width: 1,
      height: 1,
      formData: { metric: 'count' },
      queriesData: [{ data: [{ year: 2024, total: 9 }] }],
    });
    // Guessing could render a numeric dimension (e.g. a year) as the metric
    expect(props.metric.value).toBeUndefined();
  });

  test('falls back to the only numeric column when unambiguous', async () => {
    const transformProps = await getTransformProps(MetricPlugin);
    const props = transformProps({
      width: 1,
      height: 1,
      formData: { metric: 'count' },
      queriesData: [{ data: [{ name: 'a', total: 9 }] }],
    });
    expect(props.metric.value).toBe(9);
    expect(props.metric.name).toBe('total');
  });
});

describe('defineChart - Chart Options section marker', () => {
  test('the generated section carries the structural _glyphChartOptions flag', () => {
    const Plugin = defineChart({
      metadata: { name: 'S', thumbnail: MIN_THUMBNAIL },
      arguments: { title: Text.with({ label: 'Title', default: '' }) },
      transform: () => ({}),
      render: () => null as unknown as React.ReactElement,
    });
    const { controlPanel } = instantiate(Plugin);
    const sections = controlPanel.controlPanelSections as Array<{
      label?: string;
      _glyphChartOptions?: boolean;
    }>;
    const chartOptions = sections.find(s => s?._glyphChartOptions);
    expect(chartOptions).toBeDefined();
    expect(chartOptions?.label).toBe('Chart Options');
  });
});
