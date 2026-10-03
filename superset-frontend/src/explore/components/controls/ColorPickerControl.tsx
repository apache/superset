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
import { useMemo } from 'react';
import { getCategoricalSchemeRegistry, rgbaToHex } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import {
  ColorPicker,
  type RGBColor,
  type ColorValue,
} from '@superset-ui/core/components';
import ControlHeader from '../ControlHeader';
import { useTheme, type SupersetTheme } from '@apache-superset/core/theme';

const SPECIAL_COLORS = {
  Red: { r: 150, g: 0, b: 0, a: 0.2 },
  Green: { r: 0, g: 150, b: 0, a: 0.2 },
} as const;

type SpecialColorKey = keyof typeof SPECIAL_COLORS;
export type ColorPickerValue = RGBColor | SpecialColorKey | string;
export type ColorOutputFormat = 'hex' | 'rgb';

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

function toDisplayHex(
  value: ColorPickerValue | undefined,
  themeColors: Record<string, string>,
): string | undefined {
  if (!value) return undefined;

  if (typeof value === 'string') {
    if (value in SPECIAL_COLORS) {
      return rgbaToHex(SPECIAL_COLORS[value as SpecialColorKey]).toLowerCase();
    }
    if (
      themeColors &&
      Object.prototype.hasOwnProperty.call(themeColors, value)
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
  ...headerProps
}: ColorPickerControlProps) {
  const categoricalScheme = getCategoricalSchemeRegistry().get();
  const defaultPresets = categoricalScheme?.colors.slice(0, 9) || [];
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

    const specialEntry = resolveThemeTokens
      ? Object.entries(SPECIAL_COLORS).find(
          ([, rgba]) => rgbaToHex(rgba).toLowerCase() === hex,
        )
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

  const hexValue = toDisplayHex(value, themeColors);

  return (
    <div>
      <ControlHeader {...headerProps} />
      <ColorPicker
        aria-label={ariaLabel}
        value={hexValue}
        onChangeComplete={handleChange}
        presets={presets}
        showText
      />
    </div>
  );
}
