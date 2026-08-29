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
import type { SupersetTheme } from '@apache-superset/core/theme';
import { ColorSchemeEnum } from '@superset-ui/chart-controls';
import {
  headerFontSize,
  subheaderFontSize,
  metricNameFontSize,
} from '../sharedControls';

const headerFontSizes = [16, 20, 30, 48, 60];
const sharedFontSizes = [16, 20, 26, 32, 40];

const metricNameProportionValues =
  metricNameFontSize.config.options.map(
    (option: { label: string; value: number }) => option.value,
  ) ?? [];

const headerProportionValues =
  headerFontSize.config.options.map(
    (option: { label: string; value: number }) => option.value,
  ) ?? [];

const subheaderProportionValues =
  subheaderFontSize.config.options.map(
    (option: { label: string; value: number }) => option.value,
  ) ?? [];

const getFontSizeMapping = (
  proportionValues: number[],
  actualSizes: number[],
) =>
  proportionValues.reduce<Record<number, number>>((acc, value, index) => {
    acc[value] = actualSizes[index] ?? actualSizes[actualSizes.length - 1];
    return acc;
  }, {});

const metricNameFontSizesMapping = getFontSizeMapping(
  metricNameProportionValues,
  sharedFontSizes,
);
const headerFontSizesMapping = getFontSizeMapping(
  headerProportionValues,
  headerFontSizes,
);

const comparisonFontSizesMapping = getFontSizeMapping(
  subheaderProportionValues,
  sharedFontSizes,
);

export const getMetricNameFontSize = (proportionValue: number) =>
  metricNameFontSizesMapping[proportionValue] ??
  sharedFontSizes[sharedFontSizes.length - 1];

export const getHeaderFontSize = (proportionValue: number) =>
  headerFontSizesMapping[proportionValue] ??
  headerFontSizes[headerFontSizes.length - 1];

export const getComparisonFontSize = (proportionValue: number) =>
  comparisonFontSizesMapping[proportionValue] ??
  sharedFontSizes[sharedFontSizes.length - 1];

export interface ComparisonColorTokens {
  /** Color for the arrow indicator and (when the symbol is index 0) text. */
  text: string;
  /** Background color for the increase/decrease pill. */
  background: string;
  /** Foreground color for the increase/decrease pill's text. */
  strongText: string;
}

/**
 * Resolves the increase/decrease colors to use for rendering, given the
 * chart's current `increaseColor` / `decreaseColor` (from the
 * `ColorPickerControl`s added after this became customizable) and the
 * legacy `comparisonColorScheme` field.
 *
 * Charts saved before `increaseColor` / `decreaseColor` existed only have
 * `comparisonColorScheme`, a 2-choice select ('Green' | 'Red') where 'Green'
 * meant "green for increase, red for decrease" and 'Red' meant the reverse.
 * Both legacy choices map onto the same 'Green' | 'Red' semantic token names
 * used by the new controls' presets, so resolving through it here
 * reproduces the exact old behavior (including the reversed case) without a
 * data migration.
 */
export const resolveComparisonColorKeys = (
  comparisonColorScheme: string | undefined,
  increaseColor: string | undefined,
  decreaseColor: string | undefined,
): { increaseColor: string; decreaseColor: string } => {
  const legacyReversed = comparisonColorScheme === ColorSchemeEnum.Red;
  return {
    increaseColor:
      increaseColor ??
      (legacyReversed ? ColorSchemeEnum.Red : ColorSchemeEnum.Green),
    decreaseColor:
      decreaseColor ??
      (legacyReversed ? ColorSchemeEnum.Green : ColorSchemeEnum.Red),
  };
};

/**
 * Resolves a single color value (semantic token name or literal hex from
 * the color picker) to the (arrow/text, background, strong-text) triad used
 * across the comparison pills. 'Green' / 'Red' keep using the paired
 * success/error theme tokens exactly as before these colors were
 * customizable; any other value is either a theme token name (e.g.
 * 'colorPrimary', emitted by the picker's `resolveThemeTokens` option) or a
 * literal hex -- 6-digit, or 8-digit when the alpha-enabled picker is used
 * -- in which case the background is a light (~10% opacity) tint of that
 * same color.
 */
export const getComparisonColorTokens = (
  colorValue: string,
  theme: SupersetTheme,
): ComparisonColorTokens => {
  if (colorValue === ColorSchemeEnum.Green) {
    return {
      text: theme.colorSuccess,
      background: theme.colorSuccessBg,
      strongText: theme.colorSuccessText,
    };
  }
  if (colorValue === ColorSchemeEnum.Red) {
    return {
      text: theme.colorError,
      background: theme.colorErrorBg,
      strongText: theme.colorErrorText,
    };
  }
  const themeColors = theme as unknown as Record<string, string>;
  const resolvedColor = Object.prototype.hasOwnProperty.call(
    themeColors,
    colorValue,
  )
    ? themeColors[colorValue]
    : colorValue;
  // An 8-digit hex (alpha-enabled picker) already carries its own alpha
  // channel; strip it before appending the tint suffix below so the
  // background stays a valid 8-digit hex instead of stacking a second one.
  const opaqueColor = /^#[0-9a-f]{8}$/i.test(resolvedColor)
    ? resolvedColor.slice(0, 7)
    : resolvedColor;
  return {
    text: resolvedColor,
    background: `${opaqueColor}1A`,
    strongText: resolvedColor,
  };
};
