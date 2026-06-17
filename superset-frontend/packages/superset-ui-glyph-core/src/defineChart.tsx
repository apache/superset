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
 * defineChart - Single-file visualization plugin pattern
 *
 * This is the core of the Glyph pattern: define a chart with a single function
 * where the arguments define both the controls AND the props passed to render.
 *
 * No more separate files for:
 * - controlPanel.ts (generated from arguments)
 * - transformProps.ts (not needed - arguments go directly to render)
 * - buildQuery.ts (inferred from Metric/Dimension/Temporal arguments)
 */

import type { FC, ReactElement } from 'react';
import { t } from '@apache-superset/core/translation';
import {
  ChartPlugin,
  ChartMetadata,
  Behavior,
  ChartLabel,
  ChartProps,
  buildQueryContext,
  ensureIsArray,
  getMetricLabel,
  getXAxisColumn,
  isXAxisSet,
  ParseMethod,
  QueryFormData,
} from '@superset-ui/core';
import type {
  ControlPanelConfig,
  ControlPanelSectionConfig,
  ControlSetRow,
} from '@superset-ui/chart-controls';
import { sharedControls } from '@superset-ui/chart-controls';
import {
  Argument,
  Select,
  Text,
  Checkbox,
  Int,
  Color,
  ColorPicker,
  RadioButton,
  Bounds,
  Metric,
  Dimension,
  Temporal,
  NumberFormat,
  Currency,
  TimeFormat,
  ConditionalFormatting,
  isSelectArg,
  isCheckboxArg,
  isIntArg,
  isColorArg,
  isColorPickerArg,
  isRadioButtonArg,
  isBoundsArg,
  isMetricArg,
  isDimensionArg,
  isTemporalArg,
  isNumberFormatArg,
  isCurrencyArg,
  isTimeFormatArg,
  isConditionalFormattingArg,
} from './arguments';
import type {
  VisibilityFn,
  RgbaColor,
  CurrencyValue,
  ArgumentCondition,
  ConditionalFormattingRule,
} from './types';
import { GenericDataType } from '@apache-superset/core/common';

// ============================================================================
// Types
// ============================================================================

/**
 * Argument definition - either a class or a class with visibility/disabled config
 *
 * @example Simple argument
 * metric: Metric.with({ label: 'Metric' })
 *
 * @example With declarative visibility (preferred)
 * metricNameFontSize: {
 *   arg: Select.with({ ... }),
 *   visibleWhen: { showMetricName: true },
 * }
 *
 * @example With declarative disabled state
 * subtitleFontSize: {
 *   arg: Select.with({ ... }),
 *   disabledWhen: { subtitle: (val) => !val },
 * }
 *
 * @example With legacy visibility function (deprecated)
 * metricNameFontSize: {
 *   arg: Select.with({ ... }),
 *   visibility: ({ controls }) => controls?.showMetricName?.value === true,
 * }
 */
export type ArgDef =
  | typeof Argument
  | {
      arg: typeof Argument;
      /** @deprecated Use visibleWhen instead */
      visibility?: VisibilityFn;
      /** Declarative condition: show control when condition is met */
      visibleWhen?: ArgumentCondition;
      /** Declarative condition: disable control when condition is met */
      disabledWhen?: ArgumentCondition;
      /** Reset value when control is hidden */
      resetOnHide?: boolean;
    };

/**
 * Arguments object - keys become formData keys, values define controls
 */
export type ChartArguments = Record<string, ArgDef>;

/**
 * Extract the runtime value type from an argument class
 */
type ArgValue<T extends ArgDef> = T extends typeof Checkbox
  ? boolean
  : T extends typeof Int
    ? number
    : T extends typeof Select
      ? string | number
      : T extends typeof Color
        ? string
        : T extends typeof NumberFormat
          ? string
          : T extends typeof TimeFormat
            ? string
            : T extends typeof Currency
              ? CurrencyValue
              : T extends typeof ConditionalFormatting
                ? ConditionalFormattingRule[]
                : T extends typeof Metric
                  ? { value: unknown; name: string; formattedValue: string }
                  : T extends typeof Dimension
                    ? string[]
                    : T extends typeof Temporal
                      ? string
                      : T extends { arg: infer A }
                        ? A extends typeof Argument
                          ? ArgValue<A>
                          : unknown
                        : string;

/**
 * Convert arguments definition to render props type
 */
export type RenderProps<TArgs extends ChartArguments> = {
  [K in keyof TArgs]: ArgValue<TArgs[K]>;
} & {
  width: number;
  height: number;
  data: Record<string, unknown>[];
  theme: unknown;
  formData: Record<string, unknown>;
};

/**
 * Custom transform function type - processes chartProps before rendering
 */
export type TransformFn<
  TArgs extends ChartArguments,
  TExtra = Record<string, unknown>,
> = (chartProps: ChartProps, argValues: RenderProps<TArgs>) => TExtra;

/**
 * Chart definition options
 */
export interface ChartDefinition<
  TArgs extends ChartArguments,
  TExtra = Record<string, unknown>,
> {
  /** Chart metadata */
  metadata: {
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
    thumbnail: string;
    thumbnailDark?: string;
    behaviors?: Behavior[];
    credits?: string[];
    exampleGallery?: Array<{ url: string; urlDark?: string; caption?: string }>;
    supportedAnnotationTypes?: string[];
    canBeAnnotationTypes?: string[];
    useLegacyApi?: boolean;
    label?: ChartLabel;
    /** Number of query objects this chart issues (e.g. 2 for Mixed Chart) */
    queryObjectCount?: number;
    dynamicQueryObjectCount?: boolean;
    parseMethod?: ParseMethod;
    suppressContextMenu?: boolean;
    enableNoResults?: boolean;
  };

  /**
   * Argument definitions - these define both controls AND render props
   * Keys become formData keys (use snake_case for Superset convention)
   */
  arguments: TArgs;

  /**
   * Additional control panel sections (for complex controls that don't fit the argument pattern)
   */
  additionalControls?: {
    /** Prepended before auto-generated query controls (metric, groupby, adhoc_filters) */
    queryBefore?: ControlSetRow[];
    query?: ControlSetRow[];
    chartOptions?: ControlSetRow[];
  };

  /**
   * Additional complete control panel sections prepended before the Query section.
   * Use for a Time section or other sections that should appear first.
   */
  prependSections?: ControlPanelSectionConfig[];

  /**
   * Additional complete control panel sections inserted between Query and Chart Options.
   * Use for sections like Options or Formatting that should appear before Chart Options.
   */
  middleSections?: ControlPanelSectionConfig[];

  /**
   * Additional complete control panel sections appended after Query and Chart Options.
   * Use for sections like Time Comparison that need their own label, tab, etc.
   */
  additionalSections?: ControlPanelSectionConfig[];

  /**
   * Tab override for the Chart Options section (e.g., 'customize' moves it to the Customize tab).
   */
  chartOptionsTabOverride?: 'customize' | 'data';

  /**
   * Suppress the auto-generated Query section entirely.
   * Use for charts that have entirely custom sections and no standard query controls.
   */
  suppressQuerySection?: boolean;

  /**
   * Control overrides for argument-generated controls (labels, descriptions, etc.)
   */
  controlOverrides?: Record<string, Record<string, unknown>>;

  /**
   * Control overrides for controls in additionalControls (e.g., metric, color_scheme)
   * These are merged with controlOverrides in the final control panel config.
   */
  additionalControlOverrides?: Record<string, Record<string, unknown>>;

  /**
   * Form data overrides function - called to standardize controls
   * (e.g., for getStandardizedControls() in cross-filtering)
   */
  formDataOverrides?: (formData: QueryFormData) => QueryFormData;

  /**
   * onInit hook - called once when the chart's controls are first initialized.
   * Use to reset/override control values that should not persist from the
   * dataset's defaults (e.g., clearing time_grain_sqla on charts that don't
   * use it).
   */
  onInit?: ControlPanelConfig['onInit'];

  /**
   * Custom buildQuery function - use for charts that need post-processing operators
   * If not provided, a default query builder is generated from arguments
   */
  buildQuery?: (
    formData: QueryFormData,
  ) => ReturnType<typeof buildQueryContext>;

  /**
   * Custom transform function - processes raw chartProps to add computed values
   * Return value is merged into render props
   *
   * @example
   * transform: (chartProps, argValues) => {
   *   const trendlineData = computeTrendline(chartProps.queriesData[0].data);
   *   return { trendlineData, echartOptions: buildEchartOptions(trendlineData) };
   * }
   */
  transform?: TransformFn<TArgs, TExtra>;

  /**
   * The render function - receives argument values + transformed data
   */
  render: (props: RenderProps<TArgs> & TExtra) => ReactElement;
}

// ============================================================================
// Helpers
// ============================================================================

function hexToRgba(hex: string): RgbaColor {
  // Expand 3-digit shorthand (#fff -> #ffffff) before parsing
  const normalized = hex.replace(
    /^#?([a-f\d])([a-f\d])([a-f\d])$/i,
    (_, r: string, g: string, b: string) => `${r}${r}${g}${g}${b}${b}`,
  );
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
  if (result?.[1] && result[2] && result[3]) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      a: 1,
    };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

function rgbaToHex(rgba: RgbaColor): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(rgba.r)}${toHex(rgba.g)}${toHex(rgba.b)}`;
}

function getArgClass(argDef: ArgDef): typeof Argument {
  return 'arg' in argDef ? argDef.arg : argDef;
}

/**
 * Public API: resolve the argument class from an ArgDef (handles both
 * bare class form and `{ arg, visibleWhen, ... }` form).
 */
export const resolveArgClass = getArgClass;

/**
 * Public API: extract the raw visibleWhen condition from an ArgDef (if any).
 */
export function getArgVisibleWhen(
  argDef: ArgDef,
): ArgumentCondition | undefined {
  return 'arg' in argDef ? argDef.visibleWhen : undefined;
}

/**
 * Evaluate an ArgumentCondition directly from formData (no Redux controls state needed).
 *
 * Use this in rendering code to decide control visibility without going through
 * the Redux controls pipeline.
 *
 * @example
 * const isVisible = evaluateGlyphCondition({ showLegend: true }, form_data);
 */
export function evaluateGlyphCondition(
  condition: ArgumentCondition,
  formData: Record<string, unknown>,
): boolean {
  for (const [argName, expectedValue] of Object.entries(condition)) {
    const actualValue = formData[argName];
    if (typeof expectedValue === 'function') {
      if (!(expectedValue as (val: unknown) => boolean)(actualValue)) {
        return false;
      }
    } else if (actualValue !== expectedValue) {
      return false;
    }
  }
  return true;
}

/**
 * Convert a declarative ArgumentCondition to a visibility function.
 *
 * @example
 * // { showMetricName: true } becomes:
 * ({ controls }) => controls?.showMetricName?.value === true
 *
 * @example
 * // { subtitle: (val) => !!val } becomes:
 * ({ controls }) => !!controls?.subtitle?.value
 */
function conditionToVisibilityFn(condition: ArgumentCondition): VisibilityFn {
  return ({ controls }) => {
    const values: Record<string, unknown> = {};
    for (const argName of Object.keys(condition)) {
      values[argName] = controls?.[argName]?.value;
    }
    return evaluateGlyphCondition(condition, values);
  };
}

/**
 * Convert a declarative ArgumentCondition to a disabled function.
 * Same evaluation as visibility: returns true when the condition IS met
 * (the caller disables the control when this returns true).
 */
const conditionToDisabledFn = conditionToVisibilityFn as (
  condition: ArgumentCondition,
) => (state: { controls: Record<string, { value: unknown }> }) => boolean;

interface ControlVisibilityConfig {
  visibility?: VisibilityFn;
  disabled?: (state: {
    controls: Record<string, { value: unknown }>;
  }) => boolean;
  resetOnHide?: boolean;
}

function getVisibilityConfig(argDef: ArgDef): ControlVisibilityConfig {
  if ('arg' in argDef) {
    const config: ControlVisibilityConfig = {
      resetOnHide: argDef.resetOnHide,
    };

    // Prefer declarative visibleWhen over legacy visibility function
    if (argDef.visibleWhen) {
      config.visibility = conditionToVisibilityFn(argDef.visibleWhen);
    } else if (argDef.visibility) {
      config.visibility = argDef.visibility;
    }

    // Handle disabledWhen
    if (argDef.disabledWhen) {
      config.disabled = conditionToDisabledFn(argDef.disabledWhen);
    }

    return config;
  }
  return {};
}

/**
 * Generate control config from argument class.
 * Public alias: use getGlyphControlConfig() for external callers.
 */
function getControlConfig(
  argClass: typeof Argument,
  paramName: string,
): Record<string, unknown> {
  const label = argClass.label || paramName;
  const description = argClass.description || '';

  // RadioButton must be checked before Select ('options' in class matches both)
  if (isRadioButtonArg(argClass)) {
    const radioClass = argClass as typeof RadioButton;
    return {
      type: 'RadioButtonControl',
      label,
      description,
      default: radioClass.default,
      options: radioClass.options.map(opt => [opt.value, opt.label]),
      renderTrigger: true,
    };
  }

  if (isSelectArg(argClass)) {
    return {
      type: 'SelectControl',
      label,
      description,
      default: argClass.default,
      options: argClass.options,
      clearable: argClass.clearable ?? false,
      renderTrigger: true,
    };
  }

  if (isCheckboxArg(argClass)) {
    return {
      type: 'CheckboxControl',
      label,
      description,
      default: argClass.default,
      renderTrigger: true,
    };
  }

  if (isIntArg(argClass)) {
    return {
      type: 'SliderControl',
      label,
      description,
      default: argClass.default,
      min: argClass.min,
      max: argClass.max,
      step: argClass.step ?? 1,
      renderTrigger: true,
    };
  }

  // ColorPicker (RGBA object default) must be checked before Color (hex string
  // default) — both use controlType 'ColorPickerControl'.
  if (isColorPickerArg(argClass)) {
    return {
      type: 'ColorPickerControl',
      label,
      description,
      default: (argClass as typeof ColorPicker).default,
      renderTrigger: true,
    };
  }

  if (isColorArg(argClass)) {
    // eslint-disable-next-line theme-colors/no-literal-colors
    const hexDefault = argClass.default ?? '#000000';
    return {
      type: 'ColorPickerControl',
      label,
      description,
      default: hexToRgba(hexDefault),
      renderTrigger: true,
    };
  }

  if (isBoundsArg(argClass)) {
    return {
      type: 'BoundsControl',
      label,
      description,
      default: (argClass as typeof Bounds).default,
      renderTrigger: true,
    };
  }

  if (isNumberFormatArg(argClass)) {
    const formatClass = argClass as typeof NumberFormat;
    return {
      type: 'SelectControl',
      freeForm: true,
      label,
      description,
      default: formatClass.default,
      choices: formatClass.FORMAT_OPTIONS.map(opt => [opt.value, opt.label]),
      renderTrigger: true,
      tokenSeparators: ['\n', '\t', ';'],
    };
  }

  if (isCurrencyArg(argClass)) {
    const currencyClass = argClass as typeof Currency;
    return {
      type: 'CurrencyControl',
      label,
      description,
      default: currencyClass.default,
      renderTrigger: true,
    };
  }

  if (isTimeFormatArg(argClass)) {
    const timeFormatClass = argClass as typeof TimeFormat;
    return {
      type: 'SelectControl',
      freeForm: true,
      label,
      description,
      default: timeFormatClass.default,
      choices: timeFormatClass.FORMAT_OPTIONS.map(opt => [
        opt.value,
        opt.label,
      ]),
      renderTrigger: true,
    };
  }

  if (isConditionalFormattingArg(argClass)) {
    return {
      type: 'ConditionalFormattingControl',
      renderTrigger: true,
      label,
      description,
      shouldMapStateToProps() {
        return true;
      },
      mapStateToProps(
        explore: {
          datasource?: {
            verbose_map?: Record<string, string>;
            columns?: Record<string, string>;
          };
        },
        _control: unknown,
        chart: {
          queriesResponse?: Array<{
            colnames?: string[];
            coltypes?: number[];
          }>;
        },
      ) {
        const verboseMap =
          explore?.datasource?.verbose_map ??
          explore?.datasource?.columns ??
          {};
        const { colnames, coltypes } = chart?.queriesResponse?.[0] ?? {};
        const numericColumns =
          Array.isArray(colnames) && Array.isArray(coltypes)
            ? colnames
                .filter(
                  (_col: string, index: number) =>
                    coltypes[index] === GenericDataType.Numeric,
                )
                .map((colname: string) => ({
                  value: colname,
                  label:
                    (Array.isArray(verboseMap)
                      ? verboseMap[colname as unknown as number]
                      : verboseMap[colname]) ?? colname,
                  dataType: colnames && coltypes[colnames.indexOf(colname)],
                }))
            : [];
        return {
          columnOptions: numericColumns,
          verboseMap,
        };
      },
    };
  }

  // Default to TextControl
  const textClass = argClass as typeof Text;
  return {
    type: 'TextControl',
    label,
    description,
    default: textClass.default ?? '',
    placeholder: textClass.placeholder ?? '',
    renderTrigger: true,
  };
}

/**
 * Public API: get the control config object for a glyph argument class.
 * Returns the raw config (type, label, description, default, options, etc.)
 * that can be used to render a control directly.
 */
export const getGlyphControlConfig = getControlConfig;

// ============================================================================
// Control Panel Generator
// ============================================================================

function generateControlPanel<TArgs extends ChartArguments, TExtra>(
  definition: ChartDefinition<TArgs, TExtra>,
): ControlPanelConfig {
  const {
    arguments: args,
    additionalControls,
    controlOverrides,
    additionalControlOverrides,
    formDataOverrides,
    onInit,
    additionalSections,
    prependSections,
    chartOptionsTabOverride,
    middleSections,
    suppressQuerySection,
  } = definition;
  const queryControls: ControlSetRow[] = [];
  const chartOptionsControls: ControlSetRow[] = [];

  for (const [paramName, argDef] of Object.entries(args)) {
    const argClass = getArgClass(argDef);
    const { visibility, disabled, resetOnHide } = getVisibilityConfig(argDef);

    // Data arguments go in Query section — inline sharedControls directly so
    // getSectionsToRender can skip expandControlConfig for these too.
    if (isMetricArg(argClass)) {
      queryControls.push([{ name: 'metric', config: sharedControls.metric }]);
      continue;
    }
    if (isDimensionArg(argClass)) {
      queryControls.push([{ name: 'groupby', config: sharedControls.groupby }]);
      continue;
    }
    if (isTemporalArg(argClass)) {
      queryControls.push(
        [{ name: 'x_axis', config: sharedControls.x_axis }],
        [{ name: 'time_grain_sqla', config: sharedControls.time_grain_sqla }],
      );
      continue;
    }

    // Visual arguments go in Chart Options
    const controlConfig = getControlConfig(argClass, paramName);
    if (visibility) {
      controlConfig.visibility = visibility;
      controlConfig.resetOnHide = resetOnHide ?? false;
    }
    if (disabled) {
      // Superset uses shouldMapStateToProps + mapStateToProps for dynamic disabled state.
      // Both call sites (controlUtils/getControlState and ControlPanelsContainer)
      // pass the state holding `controls` as the FIRST argument.
      controlConfig.shouldMapStateToProps = () => true;
      controlConfig.mapStateToProps = (
        state: unknown,
        control: { value: unknown },
      ) => {
        const controls =
          (state as { controls?: Record<string, { value: unknown }> })
            ?.controls || {};
        return {
          disabled: disabled({ controls }),
          value: control?.value,
        };
      };
    }

    chartOptionsControls.push([
      {
        name: paramName,
        config: controlConfig as Record<string, unknown> & { type: string },
      },
    ]);
  }

  // Add adhoc_filters — inlined so getSectionsToRender skips expandControlConfig
  queryControls.push([
    { name: 'adhoc_filters', config: sharedControls.adhoc_filters },
  ]);

  // Merge additional controls
  const finalQueryControls = [
    ...(additionalControls?.queryBefore || []),
    ...queryControls,
    ...(additionalControls?.query || []),
  ];
  const finalChartOptionsControls = [
    ...chartOptionsControls,
    ...(additionalControls?.chartOptions || []),
  ];

  const config: ControlPanelConfig = {
    controlPanelSections: [
      ...(prependSections || []),
      ...(suppressQuerySection
        ? []
        : [
            {
              label: t('Query'),
              expanded: true,
              controlSetRows: finalQueryControls,
            },
          ]),
      ...(middleSections || []),
      ...(finalChartOptionsControls.length > 0
        ? [
            {
              label: t('Chart Options'),
              expanded: true,
              // Structural marker so explore can identify the auto-generated
              // section without comparing translated label strings.
              _glyphChartOptions: true,
              ...(chartOptionsTabOverride
                ? { tabOverride: chartOptionsTabOverride }
                : {}),
              controlSetRows: finalChartOptionsControls,
            },
          ]
        : []),
      ...(additionalSections || []),
    ],
  };

  // Merge both controlOverrides and additionalControlOverrides
  const mergedOverrides = {
    ...controlOverrides,
    ...additionalControlOverrides,
  };
  if (Object.keys(mergedOverrides).length > 0) {
    config.controlOverrides = mergedOverrides;
  }

  if (formDataOverrides) {
    config.formDataOverrides = formDataOverrides;
  }

  if (onInit) {
    config.onInit = onInit;
  }

  // Store raw glyph args for native rendering (bypasses expandControlConfig pipeline)
  config._glyphArgs = args;

  return config;
}

// ============================================================================
// Build Query Generator
// ============================================================================

function generateBuildQuery<TArgs extends ChartArguments>(args: TArgs) {
  // Check what data arguments we have
  const hasTemporal = Object.values(args).some(argDef =>
    isTemporalArg(getArgClass(argDef)),
  );

  return (formData: QueryFormData) =>
    buildQueryContext(formData, baseQueryObject => {
      const query = { ...baseQueryObject };

      // Add the temporal axis column. Using the core helpers (rather than a
      // hand-built BASE_AXIS object) lets buildQueryContext's
      // normalizeTimeColumn pass attach timeGrain from extras.time_grain_sqla
      // and handles adhoc x_axis columns and the DTTM_ALIAS fallback.
      if (hasTemporal && isXAxisSet(formData)) {
        query.columns = [
          ...ensureIsArray(getXAxisColumn(formData)),
          ...(query.columns || []),
        ];
      }

      return [query];
    });
}

// ============================================================================
// Transform Props Generator (Hidden - user never sees this)
// ============================================================================

function generateTransformProps<
  TArgs extends ChartArguments,
  TExtra = Record<string, unknown>,
>(args: TArgs, customTransform?: TransformFn<TArgs, TExtra>) {
  return (chartProps: ChartProps) => {
    const { width, height, queriesData, formData, theme } = chartProps;
    const data = queriesData[0]?.data || [];

    // Build render props from arguments
    const renderProps: Record<string, unknown> = {
      width,
      height,
      data,
      theme,
      formData,
    };

    for (const [paramName, argDef] of Object.entries(args)) {
      const argClass = getArgClass(argDef);

      // Handle different argument types
      if (isMetricArg(argClass)) {
        const metricValue = formData.metric || formData.metrics?.[0];
        // getMetricLabel matches the backend's column-key derivation
        // (saved metric strings, adhoc labels, aggregate(column), sqlExpression)
        let metricLabel = metricValue ? getMetricLabel(metricValue) : 'value';

        // Find the actual value by label. Only when the result set has exactly
        // one numeric column do we fall back to it — guessing among multiple
        // numeric columns could silently render a dimension value as the metric.
        let rawValue = data[0]?.[metricLabel];
        if (rawValue === undefined && data[0]) {
          const numericKeys = Object.keys(data[0]).filter(
            key => typeof data[0][key] === 'number',
          );
          if (numericKeys.length === 1) {
            [metricLabel] = numericKeys;
            rawValue = data[0][metricLabel];
          }
        }

        renderProps[paramName] = {
          value: rawValue,
          name: metricLabel,
          formattedValue: String(rawValue ?? ''),
        };
        continue;
      }

      if (isDimensionArg(argClass)) {
        renderProps[paramName] = formData.groupby || formData.columns || [];
        continue;
      }

      if (isTemporalArg(argClass)) {
        renderProps[paramName] =
          formData.x_axis || formData.granularity_sqla || '__timestamp';
        continue;
      }

      // Get value from formData - ChartProps converts formData to camelCase via
      // convertKeysToCamelCase, so check camelCase first, then snake_case fallback
      const camelParamName = paramName.replace(/_([a-z])/g, (_, c: string) =>
        c.toUpperCase(),
      );
      let value = formData[camelParamName] ?? formData[paramName];

      if (isColorPickerArg(argClass)) {
        // ColorPicker values stay in RGBA-object form (no hex conversion)
        value = value ?? (argClass as typeof ColorPicker).default;
      } else if (isColorArg(argClass)) {
        const colorClass = argClass as typeof Color;
        // eslint-disable-next-line theme-colors/no-literal-colors
        const defaultRgba = hexToRgba(colorClass.default ?? '#000000');
        const colorValue = value ?? defaultRgba;
        if (
          typeof colorValue === 'object' &&
          colorValue !== null &&
          'r' in colorValue
        ) {
          value = rgbaToHex(colorValue as RgbaColor);
        } else if (typeof colorValue !== 'string') {
          // eslint-disable-next-line theme-colors/no-literal-colors
          value = colorClass.default ?? '#000000';
        }
      } else if (isRadioButtonArg(argClass)) {
        value = value ?? (argClass as typeof RadioButton).default;
      } else if (isBoundsArg(argClass)) {
        value = value ?? (argClass as typeof Bounds).default;
      } else if (isNumberFormatArg(argClass)) {
        value =
          value ?? (argClass as typeof NumberFormat).default ?? 'SMART_NUMBER';
      } else if (isTimeFormatArg(argClass)) {
        value =
          value ?? (argClass as typeof TimeFormat).default ?? 'smart_date';
      } else if (isConditionalFormattingArg(argClass)) {
        value =
          value ?? (argClass as typeof ConditionalFormatting).default ?? [];
      } else if (isCurrencyArg(argClass)) {
        value = value ?? (argClass as typeof Currency).default ?? {};
      } else if (isSelectArg(argClass)) {
        value = value ?? (argClass as typeof Select).default;
      } else if (isCheckboxArg(argClass)) {
        value = value ?? (argClass as typeof Checkbox).default ?? false;
      } else if (isIntArg(argClass)) {
        value = value ?? (argClass as typeof Int).default ?? 0;
      } else {
        value = value ?? (argClass as typeof Text).default ?? '';
      }

      renderProps[paramName] = value;
    }

    // Apply custom transform if provided
    const baseProps = renderProps as RenderProps<TArgs>;
    if (customTransform) {
      const extraProps = customTransform(chartProps, baseProps);
      return { ...baseProps, ...extraProps } as RenderProps<TArgs> & TExtra;
    }

    return baseProps as RenderProps<TArgs> & TExtra;
  };
}

// ============================================================================
// The Main Event: defineChart
// ============================================================================

/**
 * Define a complete chart plugin with a single function.
 *
 * The arguments define both the control panel AND the props passed to render.
 * No separate controlPanel.ts, transformProps.ts, or buildQuery.ts needed.
 *
 * @example
 * ```typescript
 * export default defineChart({
 *   metadata: {
 *     name: 'My Chart',
 *     thumbnail,
 *   },
 *   arguments: {
 *     metric: Metric.with({ label: 'Metric' }),
 *     fontSize: Select.with({
 *       label: 'Font Size',
 *       options: [{ label: 'Small', value: 12 }, { label: 'Large', value: 24 }],
 *       default: 12,
 *     }),
 *   },
 *   render: ({ metric, fontSize, width, height }) => (
 *     <div style={{ fontSize }}>
 *       {metric.formattedValue}
 *     </div>
 *   ),
 * });
 * ```
 */
export function defineChart<
  TArgs extends ChartArguments,
  TExtra = Record<string, unknown>,
>(definition: ChartDefinition<TArgs, TExtra>): new () => ChartPlugin {
  const {
    metadata,
    arguments: args,
    buildQuery: customBuildQuery,
    transform,
    render,
  } = definition;

  // Create the chart component that receives transformed props
  const ChartComponent: FC<RenderProps<TArgs> & TExtra> = props =>
    render(props);

  // Generate everything from arguments (or use custom if provided)
  const controlPanel = generateControlPanel(definition);
  const transformProps = generateTransformProps(args, transform);
  const buildQuery = customBuildQuery ?? generateBuildQuery(args);

  // Create metadata. behaviors defaults to [] to match ChartMetadata's own
  // default — charts must opt in to InteractiveChart (cross-filter) etc.
  const chartMetadata = new ChartMetadata({
    name: metadata.name,
    description: metadata.description,
    category: metadata.category,
    tags: metadata.tags,
    thumbnail: metadata.thumbnail,
    thumbnailDark: metadata.thumbnailDark,
    behaviors: metadata.behaviors ?? [],
    credits: metadata.credits,
    exampleGallery: metadata.exampleGallery,
    supportedAnnotationTypes: metadata.supportedAnnotationTypes,
    canBeAnnotationTypes: metadata.canBeAnnotationTypes,
    useLegacyApi: metadata.useLegacyApi,
    label: metadata.label,
    queryObjectCount: metadata.queryObjectCount,
    dynamicQueryObjectCount: metadata.dynamicQueryObjectCount,
    parseMethod: metadata.parseMethod,
    suppressContextMenu: metadata.suppressContextMenu,
    enableNoResults: metadata.enableNoResults,
  });

  // Return a ChartPlugin class
  return class GlyphChartPlugin extends ChartPlugin {
    constructor() {
      super({
        metadata: chartMetadata,
        loadChart: () => Promise.resolve(ChartComponent),
        controlPanel,
        transformProps,
        buildQuery,
      });
    }
  };
}

// Re-export useful types for custom transforms
export type { ChartProps } from '@superset-ui/core';

export default defineChart;
