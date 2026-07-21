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
import {
  ColorPicker,
  type RGBColor,
  type ColorValue,
} from '@superset-ui/core/components';
import ControlHeader from '../ControlHeader';
import { useTheme } from '@apache-superset/core/theme';

const SPECIAL_COLORS = {
  Red: { r: 150, g: 0, b: 0, a: 0.2 },
  Green: { r: 0, g: 150, b: 0, a: 0.2 },
} as const;

type SpecialColorKey = keyof typeof SPECIAL_COLORS;
export type ColorPickerValue = RGBColor | SpecialColorKey | string;

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
}

const getReverseThemeColorMap = (
  themeColors: Record<string, any>,
): Record<string, string> => {
  const reverseMap: Record<string, string> = {};
  if (!themeColors) return reverseMap;

  Object.entries(themeColors).forEach(([name, value]) => {
    if (typeof value === 'string') {
      reverseMap[value.toLowerCase()] = name;
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
    if (themeColors && value in themeColors) {
      return themeColors[value].toLowerCase();
    }
    return value.toLowerCase();
  }

  return rgbaToHex(value).toLowerCase();
}

export default function ColorPickerControl({
  onChange,
  value,
  presets: customPresets,
  ...headerProps
}: ColorPickerControlProps) {
  const categoricalScheme = getCategoricalSchemeRegistry().get();
  const defaultPresets = categoricalScheme?.colors.slice(0, 9) || [];
  const theme = useTheme();

  const themeColors = useMemo<Record<string, string>>(
    () => (theme as any)?.colors || theme || {},
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
          if (themeColors && color in themeColors) {
            return themeColors[color].toLowerCase();
          }
          return String(color).toLowerCase();
        }),
      }));
    }

    return [
      {
        label: 'Theme colors',
        colors: defaultPresets.map(c => String(c).toLowerCase()),
      },
    ];
  }, [customPresets, themeColors, defaultPresets]);

  const handleChange = (color: ColorValue) => {
    if (!onChange) return;

    const rgb = color.toRgb();
    const hex = rgbaToHex(rgb).toLowerCase();

    const specialEntry = Object.entries(SPECIAL_COLORS).find(
      ([, rgba]) => rgbaToHex(rgba).toLowerCase() === hex,
    );

    if (specialEntry) {
      onChange(specialEntry[0] as SpecialColorKey);
      return;
    }

    if (reverseMap[hex]) {
      onChange(reverseMap[hex]);
      return;
    }

    onChange(rgb);
  };

  const hexValue = toDisplayHex(value, themeColors);

  return (
    <div>
      <ControlHeader {...headerProps} />
      <ColorPicker
        value={hexValue}
        onChangeComplete={handleChange}
        presets={presets}
        showText
      />
    </div>
  );
}
