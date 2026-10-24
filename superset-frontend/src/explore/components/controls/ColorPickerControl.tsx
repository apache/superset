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
import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { getCategoricalSchemeRegistry, rgbaToHex } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import {
  ColorPicker,
  type RGBColor,
  type ColorValue,
} from '@superset-ui/core/components';
import ControlHeader from '../ControlHeader';
import { useTheme, type SupersetTheme } from '@apache-superset/core/theme';

export const SPECIAL_COLORS = {
  Red: { r: 150, g: 0, b: 0, a: 0.2 },
  Green: { r: 0, g: 150, b: 0, a: 0.2 },
} as const;

export type SpecialColorKey = keyof typeof SPECIAL_COLORS;
export type ColorPickerValue = RGBColor | SpecialColorKey | string;
export type ColorOutputFormat = 'hex' | 'rgb';

// `SPECIAL_COLORS` are legacy 2-choice sentinel names that also happen to
// name a live semantic theme token (BigNumberPeriodOverPeriod's
// `increase_color`/`decrease_color` resolve 'Green'/'Red' to
// `theme.colorSuccess`/`theme.colorError` at render time -- see
// `getComparisonColorTokens`). When a theme token is available, showing the
// token's actual current color here keeps the picker's own preview honest
// about what the chart will render, instead of `SPECIAL_COLORS`' fixed,
// muted stand-in going stale the moment the theme's real success/error
// colors differ from it.
const SPECIAL_COLOR_THEME_TOKENS: Partial<Record<SpecialColorKey, string>> = {
  Green: 'colorSuccess',
  Red: 'colorError',
};

export interface ColorPickerControlProps {
  onChange?: (color: ColorPickerValue) => void;
  value?: ColorPickerValue;
  name?: string;
  label?: string;
  description?: string;
  renderTrigger?: boolean;
  hovered?: boolean;
  warning?: string;
  presets?: { label: string; colors: string[] }[];
  ariaLabel?: string;
  resolveThemeTokens?: boolean;
  outputFormat?: ColorOutputFormat;
  disabled?: boolean;
}

const normalizeColorToHex = (color: string): string => {
  if (!color) return '';

  if (color.startsWith('#')) {
    return color.toLowerCase();
  }

  const div = document.createElement('div');
  div.style.color = color;
  const normalized = div.style.color || '';

  const match = /^rgba?\((\d+),\s+(\d+),\s+(\d+)(?:,\s*([\d.]+))?\)$/.exec(
    normalized,
  );
  if (match) {
    return rgbaToHex({
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
      a: match[4] !== undefined ? parseFloat(match[4]) : 1,
    }).toLowerCase();
  }

  return color.toLowerCase();
};

const getReverseThemeColorMap = (
  themeColors: Record<string, string>,
): Map<string, string> => {
  const reverseMap = new Map<string, string>();
  if (!themeColors) return reverseMap;

  Object.entries(themeColors).forEach(([name, value]) => {
    if (typeof value === 'string') {
      const hex = normalizeColorToHex(value);
      if (!reverseMap.has(hex)) {
        reverseMap.set(hex, name);
      }
    }
  });

  return reverseMap;
};

export function toDisplayHex(
  value: ColorPickerValue | undefined,
  themeColors: Record<string, string>,
  resolveThemeTokens: boolean,
): string | undefined {
  if (!value) return undefined;

  if (typeof value === 'string') {
    // Theme-token / SPECIAL_COLORS resolution is opt-in via
    // `resolveThemeTokens`: callers that store arbitrary literal strings
    // (e.g. ThemeColorPickers, which never sets this flag) must not have a
    // string that happens to collide with a theme key or a SPECIAL_COLORS
    // name (a numeric antd token like `fontSize`, or the literal CSS color
    // "Red") silently reinterpreted into something else -- or, for a
    // non-string theme value, thrown on.
    if (!resolveThemeTokens) return value.toLowerCase();

    const themeToken = SPECIAL_COLOR_THEME_TOKENS[value as SpecialColorKey];
    if (
      themeToken &&
      Object.prototype.hasOwnProperty.call(themeColors, themeToken) &&
      typeof themeColors[themeToken] === 'string'
    ) {
      return themeColors[themeToken].toLowerCase();
    }
    if (value in SPECIAL_COLORS) {
      return rgbaToHex(SPECIAL_COLORS[value as SpecialColorKey]).toLowerCase();
    }
    if (
      themeColors &&
      Object.prototype.hasOwnProperty.call(themeColors, value) &&
      typeof themeColors[value] === 'string'
    ) {
      return themeColors[value as string].toLowerCase();
    }
    return value.toLowerCase();
  }

  return rgbaToHex(value).toLowerCase();
}

const extractThemeColors = (
  theme: SupersetTheme | undefined | null,
): Record<string, string> => {
  if (!theme || typeof theme !== 'object') {
    return {};
  }

  if (
    'colors' in theme &&
    typeof theme.colors === 'object' &&
    theme.colors !== null
  ) {
    return theme.colors as Record<string, string>;
  }

  return theme as unknown as Record<string, string>;
};

export default function ColorPickerControl({
  onChange,
  value,
  presets: customPresets,
  ariaLabel,
  resolveThemeTokens = false,
  outputFormat = 'rgb',
  disabled = false,
  ...headerProps
}: ColorPickerControlProps) {
  const categoricalScheme = getCategoricalSchemeRegistry().get();
  const defaultPresets = categoricalScheme?.colors?.slice(0, 9) || [];
  const theme = useTheme();

  const themeColors = useMemo<Record<string, string>>(
    () => extractThemeColors(theme),
    [theme],
  );

  const reverseMap = useMemo(
    () => getReverseThemeColorMap(themeColors),
    [themeColors],
  );

  const presets = useMemo(() => {
    if (customPresets) {
      return customPresets.map(item => ({
        label: item.label,
        colors: item.colors.map(color => {
          if (resolveThemeTokens && color in SPECIAL_COLORS) {
            // Share the trigger's lookup so the preset chip matches it.
            return (
              toDisplayHex(color as string, themeColors, true) ?? String(color)
            );
          }
          if (color in SPECIAL_COLORS) {
            return rgbaToHex(
              SPECIAL_COLORS[color as SpecialColorKey],
            ).toLowerCase();
          }
          if (
            themeColors &&
            Object.prototype.hasOwnProperty.call(themeColors, color as string)
          ) {
            return themeColors[color as string].toLowerCase();
          }
          return String(color).toLowerCase();
        }),
      }));
    }

    return [
      {
        label: t('Theme colors'),
        colors: defaultPresets.map(c => String(c).toLowerCase()),
      },
    ];
  }, [customPresets, themeColors, defaultPresets]);

  const handleChange = (color: ColorValue) => {
    if (!onChange) return;

    const rgb = color.toRgb();
    const hex = rgbaToHex(rgb).toLowerCase();

    // Match against the same hex the preset chip and trigger display, so a
    // special color picked from a theme-resolved chip maps back to its key.
    // Only keys the caller actually offered as presets are candidates;
    // otherwise an ordinary theme swatch that shares a hex with Green/Red
    // (e.g. `colorSuccess`) would be misread as the special key.
    const offeredSpecialKeys = new Set(
      (customPresets ?? []).flatMap(item =>
        item.colors.filter(color => color in SPECIAL_COLORS),
      ),
    );
    const specialEntry = resolveThemeTokens
      ? Object.keys(SPECIAL_COLORS)
          .filter(key => offeredSpecialKeys.has(key))
          .map(key => [key, toDisplayHex(key, themeColors, true)] as const)
          .find(([, displayHex]) => displayHex === hex)
      : undefined;

    if (specialEntry) {
      onChange(specialEntry[0] as SpecialColorKey);
      return;
    }

    if (resolveThemeTokens && reverseMap.has(hex)) {
      const tokenName = reverseMap.get(hex);
      if (tokenName) {
        onChange(tokenName);
        return;
      }
    }
    if (outputFormat === 'rgb') onChange(rgb);
    else onChange(hex);
  };

  const hexValue = toDisplayHex(value, themeColors, resolveThemeTokens);

  // AntD renders the swatch trigger as a plain div with no tab stop, so
  // keyboard-only users could not reach or open it. Make the trigger
  // focusable and let Enter/Space open the popup like a click would.
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = containerRef.current?.querySelector<HTMLElement>(
      '.ant-color-picker-trigger',
    );
    if (!trigger) return;
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('tabindex', disabled ? '-1' : '0');
    if (ariaLabel && !trigger.hasAttribute('aria-label'))
      trigger.setAttribute('aria-label', ariaLabel);
  });
  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (
      !disabled &&
      target.classList?.contains('ant-color-picker-trigger') &&
      (event.key === 'Enter' || event.key === ' ')
    ) {
      event.preventDefault();
      target.click();
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div ref={containerRef} onKeyDown={handleTriggerKeyDown}>
      <ControlHeader {...headerProps} />
      <ColorPicker
        aria-label={ariaLabel}
        value={hexValue}
        onChangeComplete={handleChange}
        presets={presets}
        disabled={disabled}
        showText
      />
    </div>
  );
}
