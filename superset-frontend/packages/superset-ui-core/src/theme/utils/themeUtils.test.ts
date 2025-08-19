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
import { Theme } from '../Theme';
import { ThemeAlgorithm } from '../types';

// Mock emotion's cache to avoid actual DOM operations
jest.mock('@emotion/cache', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({}),
}));

describe('themeUtils', () => {
  let lightTheme: Theme;
  let darkTheme: Theme;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create actual theme instances for testing
    lightTheme = Theme.fromConfig({
      token: {
        colorPrimary: '#1890ff',
        fontSizeXS: '8',
        fontSize: '14',
        fontSizeLG: '16',
      },
    });

    darkTheme = Theme.fromConfig({
      algorithm: ThemeAlgorithm.DARK,
      token: {
        colorPrimary: '#1890ff',
        fontSizeXS: '8',
        fontSize: '14',
        fontSizeLG: '16',
      },
    });
  });

  describe('getFontSize', () => {
    it('returns correct font size for given key', () => {
      expect(getFontSize(lightTheme.theme, 'xs')).toBe('8');
      expect(getFontSize(lightTheme.theme, 'm')).toBe('14');
      expect(getFontSize(lightTheme.theme, 'l')).toBe('16');
    });

    it('defaults to medium font size when no key is provided', () => {
      expect(getFontSize(lightTheme.theme)).toBe('14');
    });

    it('uses antd default when specific size not overridden', () => {
      // Create theme with minimal config - antd will provide defaults
      const minimalTheme = Theme.fromConfig({
        token: { fontSize: '14' },
      });

      // Ant Design provides fontSizeXS: '8' by default
      expect(getFontSize(minimalTheme.theme, 'xs')).toBe('8');
      expect(getFontSize(minimalTheme.theme, 'm')).toBe('14');
    });
  });

  describe('isThemeDark', () => {
    it('returns false for light theme', () => {
      expect(isThemeDark(lightTheme.theme)).toBe(false);
    });

    it('returns true for dark theme', () => {
      expect(isThemeDark(darkTheme.theme)).toBe(true);
    });
  });

  describe('getColorVariants', () => {
    it('returns correct variants for primary color', () => {
      const variants = getColorVariants(lightTheme.theme, 'primary');

      expect(variants.text).toBeDefined();
      expect(variants.bg).toBeDefined();
      expect(variants.border).toBeDefined();
      expect(variants.active).toBeDefined();
    });

    it('returns grayscale variants for default color in light theme', () => {
      const variants = getColorVariants(lightTheme.theme, 'default');

      expect(variants.active).toBe('#222');
      expect(variants.textActive).toBe('#444');
      expect(variants.text).toBe('#555');
      expect(variants.bg).toBe('#F4F4F4');
    });

    it('returns inverted grayscale variants for default color in dark theme', () => {
      const variants = getColorVariants(darkTheme.theme, 'default');

      // In dark theme, colors should be inverted
      expect(variants.active).toBe('#dddddd'); // Inverted #222
      expect(variants.textActive).toBe('#bbbbbb'); // Inverted #444
      expect(variants.text).toBe('#aaaaaa'); // Inverted #555
    });

    it('returns same variants for grayscale color as default', () => {
      const defaultVariants = getColorVariants(lightTheme.theme, 'default');
      const grayscaleVariants = getColorVariants(lightTheme.theme, 'grayscale');

      expect(defaultVariants).toEqual(grayscaleVariants);
    });

    it('handles missing color tokens gracefully', () => {
      const variants = getColorVariants(lightTheme.theme, 'nonexistent');

      // Should return undefined for missing tokens
      expect(variants.active).toBeUndefined();
      expect(variants.text).toBeUndefined();
      expect(variants.bg).toBeUndefined();
    });
  });
});
