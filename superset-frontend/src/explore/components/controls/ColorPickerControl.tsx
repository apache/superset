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

function toDisplayHex(
  value: ColorPickerValue | undefined,
  theme?: ReturnType<typeof useTheme>,
): string | undefined {
  if (!value) return undefined;

  if (typeof value === 'string') {
    if (value in SPECIAL_COLORS) {
      return rgbaToHex(SPECIAL_COLORS[value as SpecialColorKey]);
    }
    if (theme && value in theme) {
      return theme[value as keyof typeof theme];
    }
    return value;
  }

  return rgbaToHex(value);
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

  const presets = customPresets
    ? customPresets.map(item => ({
        label: item.label,
        colors: item.colors.map(color => {
          if (theme && color in theme) {
            return theme[color as keyof typeof theme];
          }
          if (color in SPECIAL_COLORS) {
            return rgbaToHex(SPECIAL_COLORS[color as SpecialColorKey]);
          }
          return color;
        }),
      }))
    : [{ label: 'Theme colors', colors: defaultPresets }];
  const handleChange = (color: ColorValue) => {
    if (!onChange) return;

    const hex = rgbaToHex(color.toRgb());

    const specialEntry = Object.entries(SPECIAL_COLORS).find(
      ([, rgba]) => rgbaToHex(rgba).toLowerCase() === hex.toLowerCase(),
    );

    if (specialEntry) {
      onChange(specialEntry[0]);
    } else {
      const rgb = color.toRgb();
      onChange({
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        a: rgb.a,
      });
    }
  };

  const hexValue = toDisplayHex(value, theme);

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
