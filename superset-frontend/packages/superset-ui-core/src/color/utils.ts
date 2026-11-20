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

export function getContrastingColor(color: string, thresholds = 186) {
  const parsed = parseColor(color);
  if (!parsed.isValid()) {
    throw new Error(`Invalid color: ${color}`);
  }
  const { r, g, b } = parsed.toRgb();
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
  return colord(h).toRgbString();
}

export function rgbToHex(red: number, green: number, blue: number) {
  return colord({ r: red, g: green, b: blue }).toHex();
}

export function rgbaToHex(rgb: RGBColor): string {
  return colord(rgb).toHex();
}

// the color at 60% opacity
export const forceHexAlpha = (color: string | RGBColor): string =>
  parseColor(color).alpha(0.6).toHex();
