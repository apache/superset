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
import { getCategoricalSchemeRegistry } from '@superset-ui/core';
import {
  ColorPicker,
  type RGBColor,
  type ColorValue,
} from '@superset-ui/core/components';
import ControlHeader from '../ControlHeader';

export interface ColorPickerControlProps {
  onChange?: (color: RGBColor) => void;
  value?: RGBColor;
  name?: string;
  label?: string;
  description?: string;
  renderTrigger?: boolean;
  hovered?: boolean;
  warning?: string;
}

function rgbToHex(rgb: RGBColor): string {
  const { r, g, b, a = 1 } = rgb;
  const toHex = (value: number) => {
    const hex = Math.round(value).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };

  const hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;

  if (a !== undefined && a !== 1) {
    return `${hexColor}${toHex(Math.round(a * 255))}`;
  }

  return hexColor;
}

export default function ColorPickerControl({
  onChange,
  value,
  ...headerProps
}: ColorPickerControlProps) {
  const categoricalScheme = getCategoricalSchemeRegistry().get();
  const presetColors = categoricalScheme?.colors.slice(0, 9) || [];

  const handleChange = (color: ColorValue) => {
    if (onChange) {
      const rgb = color.toRgb();
      onChange({
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        a: rgb.a,
      });
    }
  };

  const hexValue = value ? rgbToHex(value) : undefined;

  return (
    <div>
      <ControlHeader {...headerProps} />
      <ColorPicker
        value={hexValue}
        onChangeComplete={handleChange}
        presets={[{ label: 'Theme colors', colors: presetColors }]}
        showText
      />
    </div>
  );
}
