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
import { getFontSize, getColorVariants, isThemeDark } from './themeUtils';
import type { SupersetTheme } from '../types';

// Mock theme tokens for testing
const mockLightTheme: SupersetTheme = {
  fontSize: '14',
  fontSizeXS: '8',
  fontSizeSM: '12',
  fontSizeLG: '16',
  fontSizeXL: '20',
  fontSizeXXL: '28',
  colorBgContainer: '#ffffff',
  colorPrimary: '#1890ff',
  colorPrimaryActive: '#096dd9',
  colorPrimaryBg: '#e6f7ff',
  colorPrimaryBorder: '#91d5ff',
  colorPrimaryBorderHover: '#40a9ff',
  colorPrimaryHover: '#40a9ff',
  colorPrimaryText: '#1890ff',
  colorPrimaryTextActive: '#096dd9',
  colorPrimaryTextHover: '#40a9ff',
  colorErrorActive: '#d9363e',
  colorErrorBg: '#fff1f0',
  colorErrorBorder: '#ffa39e',
  colorErrorBorderHover: '#ff7875',
  colorErrorHover: '#ff4d4f',
  colorErrorText: '#ff4d4f',
  colorErrorTextActive: '#d9363e',
  colorErrorTextHover: '#ff7875',
} as SupersetTheme;

const mockDarkTheme: SupersetTheme = {
  ...mockLightTheme,
  colorBgContainer: '#141414',
} as SupersetTheme;

describe('themeUtils', () => {
  describe('getFontSize', () => {
    it('returns correct font size for given key', () => {
      expect(getFontSize(mockLightTheme, 'xs')).toBe('8');
      expect(getFontSize(mockLightTheme, 's')).toBe('12');
      expect(getFontSize(mockLightTheme, 'm')).toBe('14');
      expect(getFontSize(mockLightTheme, 'l')).toBe('16');
      expect(getFontSize(mockLightTheme, 'xl')).toBe('20');
      expect(getFontSize(mockLightTheme, 'xxl')).toBe('28');
    });

    it('defaults to medium font size when no key is provided', () => {
      const mediumSize = getFontSize(mockLightTheme, 'm');
      expect(getFontSize(mockLightTheme)).toBe(mediumSize);
      expect(getFontSize(mockLightTheme)).toBe('14');
    });

    it('falls back to fontSize when specific size not available', () => {
      const themeWithMissingSize = {
        ...mockLightTheme,
        fontSizeXS: undefined,
      } as SupersetTheme;

      expect(getFontSize(themeWithMissingSize, 'xs')).toBe('14');
    });
  });

  describe('isThemeDark', () => {
    it('returns false for light theme', () => {
      expect(isThemeDark(mockLightTheme)).toBe(false);
    });

    it('returns true for dark theme', () => {
      expect(isThemeDark(mockDarkTheme)).toBe(true);
    });

    it('correctly identifies borderline colors', () => {
      const borderlineLight = {
        ...mockLightTheme,
        colorBgContainer: '#808080', // Medium gray
      } as SupersetTheme;

      const borderlineDark = {
        ...mockLightTheme,
        colorBgContainer: '#404040', // Darker gray
      } as SupersetTheme;

      expect(isThemeDark(borderlineLight)).toBe(false);
      expect(isThemeDark(borderlineDark)).toBe(true);
    });
  });

  describe('getColorVariants', () => {
    it('returns correct variants for primary color', () => {
      const variants = getColorVariants(mockLightTheme, 'primary');

      expect(variants.active).toBe('#096dd9');
      expect(variants.textActive).toBe('#096dd9');
      expect(variants.text).toBe('#1890ff');
      expect(variants.textHover).toBe('#40a9ff');
      expect(variants.hover).toBe('#40a9ff');
      expect(variants.borderHover).toBe('#40a9ff');
      expect(variants.border).toBe('#91d5ff');
      expect(variants.bg).toBe('#e6f7ff');
    });

    it('returns correct variants for error color', () => {
      const variants = getColorVariants(mockLightTheme, 'error');

      expect(variants.active).toBe('#d9363e');
      expect(variants.text).toBe('#ff4d4f');
      expect(variants.bg).toBe('#fff1f0');
      expect(variants.border).toBe('#ffa39e');
    });

    it('returns grayscale variants for default color in light theme', () => {
      const variants = getColorVariants(mockLightTheme, 'default');

      expect(variants.active).toBe('#222');
      expect(variants.textActive).toBe('#444');
      expect(variants.text).toBe('#555');
      expect(variants.textHover).toBe('#666');
      expect(variants.hover).toBe('#888');
      expect(variants.borderHover).toBe('#AAA');
      expect(variants.border).toBe('#CCC');
      expect(variants.bgHover).toBe('#DDD');
      expect(variants.bg).toBe('#F4F4F4');
    });

    it('returns inverted grayscale variants for default color in dark theme', () => {
      const variants = getColorVariants(mockDarkTheme, 'default');

      // In dark theme, colors should be inverted
      expect(variants.active).toBe('#dddddd'); // Inverted #222
      expect(variants.textActive).toBe('#bbbbbb'); // Inverted #444
      expect(variants.text).toBe('#aaaaaa'); // Inverted #555
      expect(variants.textHover).toBe('#999999'); // Inverted #666
      expect(variants.hover).toBe('#777777'); // Inverted #888
      expect(variants.borderHover).toBe('#555555'); // Inverted #AAA
      expect(variants.border).toBe('#333333'); // Inverted #CCC
      expect(variants.bgHover).toBe('#222222'); // Inverted #DDD
      expect(variants.bg).toBe('#0b0b0b'); // Inverted #F4F4F4
    });

    it('returns same variants for grayscale color as default', () => {
      const defaultVariants = getColorVariants(mockLightTheme, 'default');
      const grayscaleVariants = getColorVariants(mockLightTheme, 'grayscale');

      expect(defaultVariants).toEqual(grayscaleVariants);
    });

    it('handles missing color tokens gracefully', () => {
      const variants = getColorVariants(mockLightTheme, 'nonexistent');

      // Should return undefined for missing tokens
      expect(variants.active).toBeUndefined();
      expect(variants.text).toBeUndefined();
      expect(variants.bg).toBeUndefined();
    });
  });
});
