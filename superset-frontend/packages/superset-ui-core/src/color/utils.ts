/*
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
import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';
import { type RGBColor } from '@superset-ui/core/components';

// custom color schemes can name colors such as `forestgreen`
extend([namesPlugin]);

// Accepts any CSS color, and a hex code without `#` as these helpers always did
const parseColor = (color: string | RGBColor) => {
  const parsed = colord(color);
  return parsed.isValid() || typeof color !== 'string'
    ? parsed
    : colord(`#${color}`);
};

const rgbRegex = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/;
export function getContrastingColor(color: string, thresholds = 186) {
  let r = 0;
  let g = 0;
  let b = 0;
  if (color.length > 7) {
    // rgb
    const matchColor = rgbRegex.exec(color);
    if (!matchColor) {
      throw new Error(`Invalid color: ${color}`);
    }
    r = parseInt(matchColor[1], 10);
    g = parseInt(matchColor[2], 10);
    b = parseInt(matchColor[3], 10);
  } else {
    // hex
    let hex = color;
    if (hex.startsWith('#')) {
      hex = hex.substring(1);
    }
    // #FFF
    if (hex.length === 3) {
      hex = [hex[0], hex[0], hex[1], hex[1], hex[2], hex[2]].join('');
    }
    if (hex.length !== 6) {
      throw new Error(`Invalid color: ${color}`);
    }
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  }

  return r * 0.299 + g * 0.587 + b * 0.114 > thresholds ? '#000' : '#FFF';
}

export function getAnalogousColors(colors: string[], results: number) {
  const generatedColors: string[] = [];

  // A fan of `results + 3` opaque hues 12° apart, centered on each color, without
  // its first three
  const start = -6 * (results + 3);
  const analogousColors = colors.map(color => {
    const base = parseColor(color).alpha(1);
    return Array.from({ length: results }, (_, i) =>
      base.rotate(start + 12 * (i + 3)).toHex(),
    );
  });

  // [[A, AA, AAA], [B, BB, BBB]] => [A, B, AA, BB, AAA, BBB]
  while (analogousColors[analogousColors.length - 1]?.length) {
    analogousColors.forEach(colors => {
      generatedColors.push(colors.shift() as string);
    });
  }

  return generatedColors;
}

export function addAlpha(color: string, opacity: number): string {
  // opacity value should be between 0 and 1.
  if (opacity > 1 || opacity < 0) {
    throw new Error(`The opacity should between 0 and 1, but got: ${opacity}`);
  }
  // the alpha value is between 00 - FF
  const alpha = `0${Math.round(opacity * 255)
    .toString(16)
    .toUpperCase()}`.slice(-2);

  return `${color}${alpha}`;
}

export function hexToRgb(h: string) {
  let r = '0';
  let g = '0';
  let b = '0';

  // 3 digits
  if (h.length === 4) {
    r = `0x${h[1]}${h[1]}`;
    g = `0x${h[2]}${h[2]}`;
    b = `0x${h[3]}${h[3]}`;

    // 6 digits
  } else if (h.length === 7) {
    r = `0x${h[1]}${h[2]}`;
    g = `0x${h[3]}${h[4]}`;
    b = `0x${h[5]}${h[6]}`;
  }

  return `rgb(${+r}, ${+g}, ${+b})`;
}

export function rgbToHex(red: number, green: number, blue: number) {
  let r = red.toString(16);
  let g = green.toString(16);
  let b = blue.toString(16);

  if (r.length === 1) r = `0${r}`;
  if (g.length === 1) g = `0${g}`;
  if (b.length === 1) b = `0${b}`;

  return `#${r}${g}${b}`;
}

export function rgbaToHex(rgb: RGBColor): string {
  const { r, g, b, a = 1 } = rgb;
  const clampChannel = (value: number) =>
    Math.min(255, Math.max(0, Math.round(value)));
  const clampAlpha = (value: number) => Math.min(1, Math.max(0, value));
  const toHex = (value: number) => {
    const hex = value.toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  const hexColor = `#${toHex(clampChannel(r))}${toHex(clampChannel(g))}${toHex(clampChannel(b))}`;
  const clampedAlpha = clampAlpha(a);
  if (clampedAlpha !== 1) {
    return `${hexColor}${toHex(Math.round(clampedAlpha * 255))}`;
  }
  return hexColor;
}

export const forceHexAlpha = (color: string | RGBColor): string => {
  if (typeof color === 'object' && color !== null) {
    return rgbaToHex({ ...color, a: 0.6 });
  }

  let hex = color.startsWith('#') ? color : `#${color}`;

  // Expand shorthand hex (#rgb, #rgba) to full length before appending or
  // replacing the alpha channel, otherwise the result is not a valid 6- or
  // 8-digit CSS hex color.
  if (hex.length === 4 || hex.length === 5) {
    hex = `#${hex
      .slice(1)
      .split('')
      .map(char => char + char)
      .join('')}`;
  }

  if (hex.length === 9) {
    return `${hex.slice(0, -2)}99`;
  }

  return `${hex}99`;
};
