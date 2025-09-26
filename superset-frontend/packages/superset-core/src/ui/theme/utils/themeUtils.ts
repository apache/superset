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
import tinycolor from 'tinycolor2';
import { useTheme as useEmotionTheme } from '@emotion/react';
import type { SupersetTheme, FontSizeKey, ColorVariants } from '../types';

const fontSizeMap: Record<FontSizeKey, keyof SupersetTheme> = {
  xs: 'fontSizeXS',
  s: 'fontSizeSM',
  m: 'fontSize',
  l: 'fontSizeLG',
  xl: 'fontSizeXL',
  xxl: 'fontSizeXXL',
};

/**
 * Get font size from theme tokens based on size key
 * @param theme - Theme tokens from useTheme()
 * @param size - Font size key
 * @returns Font size as string
 */
export function getFontSize(theme: SupersetTheme, size?: FontSizeKey): string {
  const key = fontSizeMap[size || 'm'];
  return String(theme[key] || theme.fontSize);
}

/**
 * Get color variants for a given color type from theme tokens
 * @param theme - Theme tokens from useTheme()
 * @param color - Color type (e.g., 'primary', 'error', 'success')
 * @returns ColorVariants object with bg, border, text colors etc.
 */
export function getColorVariants(
  theme: SupersetTheme,
  color: string,
): ColorVariants {
  const firstLetterCapped = color.charAt(0).toUpperCase() + color.slice(1);

  if (color === 'default' || color === 'grayscale') {
    const isDark = isThemeDark(theme);

    const flipBrightness = (baseColor: string): string => {
      if (!isDark) return baseColor;
      const { r, g, b } = tinycolor(baseColor).toRgb();
      const invertedColor = tinycolor({ r: 255 - r, g: 255 - g, b: 255 - b });
      return invertedColor.toHexString();
    };

    return {
      active: flipBrightness('#222'),
      textActive: flipBrightness('#444'),
      text: flipBrightness('#555'),
      textHover: flipBrightness('#666'),
      hover: flipBrightness('#888'),
      borderHover: flipBrightness('#AAA'),
      border: flipBrightness('#CCC'),
      bgHover: flipBrightness('#DDD'),
      bg: flipBrightness('#F4F4F4'),
    };
  }

  return {
    active: theme[
      `color${firstLetterCapped}Active` as keyof SupersetTheme
    ] as string,
    textActive: theme[
      `color${firstLetterCapped}TextActive` as keyof SupersetTheme
    ] as string,
    text: theme[
      `color${firstLetterCapped}Text` as keyof SupersetTheme
    ] as string,
    textHover: theme[
      `color${firstLetterCapped}TextHover` as keyof SupersetTheme
    ] as string,
    hover: theme[
      `color${firstLetterCapped}Hover` as keyof SupersetTheme
    ] as string,
    borderHover: theme[
      `color${firstLetterCapped}BorderHover` as keyof SupersetTheme
    ] as string,
    border: theme[
      `color${firstLetterCapped}Border` as keyof SupersetTheme
    ] as string,
    bgHover: theme[
      `color${firstLetterCapped}BgHover` as keyof SupersetTheme
    ] as string,
    bg: theme[`color${firstLetterCapped}Bg` as keyof SupersetTheme] as string,
  };
}

/**
 * Check if the current theme is dark mode based on background color
 * @param theme - Theme tokens from useTheme()
 * @returns true if theme is dark, false if light
 */
export function isThemeDark(theme: SupersetTheme): boolean {
  return tinycolor(theme.colorBgContainer).isDark();
}

/**
 * Hook to determine if the current theme is dark mode
 * @returns true if theme is dark, false if light
 */
export function useThemeMode(): boolean {
  const theme = useEmotionTheme() as SupersetTheme;
  return isThemeDark(theme);
}
