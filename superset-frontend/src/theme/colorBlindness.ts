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
 * Color blindness transformation utilities using the Machado et al. (2009) algorithm.
 * This is the same algorithm used by Chrome DevTools for vision deficiency simulation.
 *
 * Reference: Machado, G. M., Oliveira, M. M., & Fernandes, L. A. (2009).
 * "A physiologically-based model for simulation of color vision deficiency."
 * IEEE Transactions on Visualization and Computer Graphics.
 *
 */

import type { ColorBlindMode } from '@apache-superset/core/ui';

// Re-export the type for convenience
export type { ColorBlindMode };

/**
 * Transformation matrices for color blindness simulation.
 * These matrices transform RGB colors to simulate how they appear
 * to people with different types of color blindness.
 */

// Protanopia: Red cone deficiency (~1% of males)
// L-cones are missing or non-functional
// Reds appear darker and shift toward green/brown
const PROTANOPIA_MATRIX = [
  [0.152286, 1.052583, -0.204868],
  [0.114503, 0.786281, 0.099216],
  [-0.003882, -0.048116, 1.051998],
];

// Deuteranopia: Green cone deficiency (~6% of males, most common)
// M-cones are missing or non-functional
// Greens appear shifted toward brown/yellow
const DEUTERANOPIA_MATRIX = [
  [0.367322, 0.860646, -0.227968],
  [0.280085, 0.672501, 0.047414],
  [-0.01182, 0.04294, 0.968881],
];

// Tritanopia: Blue cone deficiency (~0.01% of population)
// S-cones are missing or non-functional
// Blues appear greenish, yellows appear pink
const TRITANOPIA_MATRIX = [
  [1.255528, -0.076749, -0.178779],
  [-0.078411, 0.930809, 0.147602],
  [0.004733, 0.691367, 0.3039],
];

// Achromatopsia: Complete color blindness (~1 in 30,000)
// No color perception - everything appears in grayscale
// Uses standard luminance weights (ITU-R BT.709)
// Note: This is not part of Machado's model as it's not a cone deficiency
const ACHROMATOPSIA_MATRIX = [
  [0.2126, 0.7152, 0.0722],
  [0.2126, 0.7152, 0.0722],
  [0.2126, 0.7152, 0.0722],
];

/**
 * Converts a hex color string to RGB values (0-255).
 */
function hexToRgb(hex: string): [number, number, number] | null {
  // Remove # if present
  const cleanHex = hex.replace(/^#/, '');

  // Handle shorthand hex (#fff -> #ffffff)
  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split('')
          .map(c => c + c)
          .join('')
      : cleanHex;

  if (fullHex.length !== 6) {
    return null;
  }

  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return null;
  }

  return [r, g, b];
}

/**
 * Converts RGB values (0-255) to a hex color string.
 */
function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (val: number) => clamp(val).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Applies a transformation matrix to RGB values.
 */
function applyMatrix(
  r: number,
  g: number,
  b: number,
  matrix: number[][],
): [number, number, number] {
  const newR = matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b;
  const newG = matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b;
  const newB = matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b;
  return [newR, newG, newB];
}

/**
 * Gets the transformation matrix for a given color blind mode.
 */
function getMatrix(mode: ColorBlindMode): number[][] | null {
  switch (mode) {
    case 'protanopia':
      return PROTANOPIA_MATRIX;
    case 'deuteranopia':
      return DEUTERANOPIA_MATRIX;
    case 'tritanopia':
      return TRITANOPIA_MATRIX;
    case 'achromatopsia':
      return ACHROMATOPSIA_MATRIX;
    default:
      return null;
  }
}

/**
 * Transforms a hex color for a specific color blindness type.
 * Returns the original color if mode is 'none' or color is invalid.
 */
export function transformColorForColorBlindness(
  hexColor: string,
  mode: ColorBlindMode,
): string {
  if (mode === 'none') {
    return hexColor;
  }

  const rgb = hexToRgb(hexColor);
  if (!rgb) {
    return hexColor;
  }

  const matrix = getMatrix(mode);
  if (!matrix) {
    return hexColor;
  }

  const [r, g, b] = applyMatrix(rgb[0], rgb[1], rgb[2], matrix);
  return rgbToHex(r, g, b);
}

/**
 * Checks if a value looks like a color (hex format).
 */
function isHexColor(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
}

/**
 * Recursively transforms all color values in an object.
 * Only transforms values that look like hex colors (#xxx or #xxxxxx).
 */
export function transformColorsInObject<T>(obj: T, mode: ColorBlindMode): T {
  if (mode === 'none') {
    return obj;
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (isHexColor(obj)) {
    return transformColorForColorBlindness(obj, mode) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => transformColorsInObject(item, mode)) as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = transformColorsInObject(value, mode);
    }
    return result as T;
  }

  return obj;
}

/**
 * Transforms all color tokens in a theme configuration.
 * This is the main function used by the theme system.
 */
export function transformThemeForColorBlindness<T extends object>(
  themeConfig: T,
  mode: ColorBlindMode,
): T {
  if (mode === 'none') {
    return themeConfig;
  }

  return transformColorsInObject(themeConfig, mode);
}

/**
 * Gets a human-readable label for a color blind mode.
 */
export function getColorBlindModeLabel(mode: ColorBlindMode): string {
  switch (mode) {
    case 'protanopia':
      return 'Protanopia (Red-blind)';
    case 'deuteranopia':
      return 'Deuteranopia (Green-blind)';
    case 'tritanopia':
      return 'Tritanopia (Blue-blind)';
    case 'achromatopsia':
      return 'Achromatopsia (Grayscale)';
    default:
      return 'None';
  }
}

/**
 * Gets a description of what each color blind mode affects.
 */
export function getColorBlindModeDescription(mode: ColorBlindMode): string {
  switch (mode) {
    case 'protanopia':
      return 'Difficulty distinguishing red from green. Reds appear darker.';
    case 'deuteranopia':
      return 'Most common type. Difficulty distinguishing green from red.';
    case 'tritanopia':
      return 'Rare. Difficulty distinguishing blue from yellow.';
    case 'achromatopsia':
      return 'Complete color blindness. Only perceives shades of gray.';
    default:
      return 'No color transformation applied.';
  }
}

export const COLOR_BLIND_MODES: ColorBlindMode[] = [
  'none',
  'protanopia',
  'deuteranopia',
  'tritanopia',
  'achromatopsia',
];
