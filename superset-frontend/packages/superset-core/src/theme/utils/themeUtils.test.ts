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
import { theme as antdTheme } from 'antd';
import {
  getFontSize,
  getColorVariants,
  isThemeDark,
  isThemeConfigDark,
} from './themeUtils';
import { Theme } from '../Theme';
import { ThemeAlgorithm } from '../types';

// Mock emotion's cache to avoid actual DOM operations
jest.mock('@emotion/cache', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({}),
}));

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

test('getFontSize returns correct font size for given key', () => {
  expect(getFontSize(lightTheme.theme, 'xs')).toBe('8');
  expect(getFontSize(lightTheme.theme, 'm')).toBe('14');
  expect(getFontSize(lightTheme.theme, 'l')).toBe('16');
});

test('getFontSize defaults to medium font size when no key is provided', () => {
  expect(getFontSize(lightTheme.theme)).toBe('14');
});

test('getFontSize uses antd default when specific size not overridden', () => {
  // Create theme with minimal config - antd will provide defaults
  const minimalTheme = Theme.fromConfig({
    token: { fontSize: '14' },
  });

  expect(getFontSize(minimalTheme.theme, 'xs')).toBe('14');
  expect(getFontSize(minimalTheme.theme, 'm')).toBe('14');
});

test('isThemeDark returns false for light theme', () => {
  expect(isThemeDark(lightTheme.theme)).toBe(false);
});

test('isThemeDark returns true for dark theme', () => {
  expect(isThemeDark(darkTheme.theme)).toBe(true);
});

test('getColorVariants returns correct variants for primary color', () => {
  const variants = getColorVariants(lightTheme.theme, 'primary');

  expect(variants.text).toBeDefined();
  expect(variants.bg).toBeDefined();
  expect(variants.border).toBeDefined();
  expect(variants.active).toBeDefined();
});

test('getColorVariants returns grayscale variants for default color in light theme', () => {
  const variants = getColorVariants(lightTheme.theme, 'default');

  expect(variants.active).toBe('#222');
  expect(variants.textActive).toBe('#444');
  expect(variants.text).toBe('#555');
  expect(variants.bg).toBe('#F4F4F4');
});

test('getColorVariants returns inverted grayscale variants for default color in dark theme', () => {
  const variants = getColorVariants(darkTheme.theme, 'default');

  // In dark theme, colors should be inverted
  expect(variants.active).toBe('#dddddd'); // Inverted #222
  expect(variants.textActive).toBe('#bbbbbb'); // Inverted #444
  expect(variants.text).toBe('#aaaaaa'); // Inverted #555
});

test('getColorVariants returns same variants for grayscale color as default', () => {
  const defaultVariants = getColorVariants(lightTheme.theme, 'default');
  const grayscaleVariants = getColorVariants(lightTheme.theme, 'grayscale');

  expect(defaultVariants).toEqual(grayscaleVariants);
});

test('getColorVariants handles missing color tokens gracefully', () => {
  const variants = getColorVariants(lightTheme.theme, 'nonexistent');

  // Should return undefined for missing tokens
  expect(variants.active).toBeUndefined();
  expect(variants.text).toBeUndefined();
  expect(variants.bg).toBeUndefined();
});

test('isThemeConfigDark returns true for config with dark algorithm', () => {
  const config = {
    algorithm: antdTheme.darkAlgorithm,
  };
  expect(isThemeConfigDark(config)).toBe(true);
});

test('isThemeConfigDark returns true for config with dark algorithm in array', () => {
  const config = {
    algorithm: [antdTheme.darkAlgorithm, antdTheme.compactAlgorithm],
  };
  expect(isThemeConfigDark(config)).toBe(true);
});

test('isThemeConfigDark returns false for config without dark algorithm', () => {
  const config = {
    algorithm: antdTheme.defaultAlgorithm,
  };
  expect(isThemeConfigDark(config)).toBe(false);
});

test('isThemeConfigDark returns false for config with no algorithm', () => {
  const config = {
    token: {
      colorPrimary: '#1890ff',
    },
  };
  expect(isThemeConfigDark(config)).toBe(false);
});

test('isThemeConfigDark detects manually-created dark theme without dark algorithm', () => {
  // This is the edge case: dark colors without dark algorithm
  const config = {
    token: {
      colorBgContainer: '#1a1a1a', // Dark background
      colorBgBase: '#0a0a0a', // Dark base
      colorText: '#ffffff', // Light text
    },
  };
  expect(isThemeConfigDark(config)).toBe(true);
});

test('isThemeConfigDark does not false-positive on light theme with custom colors', () => {
  const config = {
    token: {
      colorBgContainer: '#ffffff', // Light background
      colorBgBase: '#f5f5f5', // Light base
      colorText: '#000000', // Dark text
    },
  };
  expect(isThemeConfigDark(config)).toBe(false);
});

test('isThemeConfigDark handles partial color tokens gracefully', () => {
  // With actual theme computation, a dark colorBgContainer results in a dark theme
  const config = {
    token: {
      colorBgContainer: '#1a1a1a', // Dark background
      // Missing other color tokens
    },
  };
  expect(isThemeConfigDark(config)).toBe(true);
});

test('isThemeConfigDark respects colorBgContainer as the primary indicator', () => {
  // The computed theme uses colorBgContainer as the main background
  const darkConfig = {
    token: {
      colorBgContainer: '#1a1a1a', // Dark background
      colorText: '#000000', // Dark text (unusual but doesn't override)
    },
  };
  expect(isThemeConfigDark(darkConfig)).toBe(true);

  const lightConfig = {
    token: {
      colorBgContainer: '#ffffff', // Light background
      colorText: '#ffffff', // Light text (unusual but doesn't override)
    },
  };
  expect(isThemeConfigDark(lightConfig)).toBe(false);
});

test('isThemeConfigDark handles non-string color tokens gracefully', () => {
  const config = {
    token: {
      colorBgContainer: undefined,
      colorText: null,
      colorBgBase: 123, // Invalid type
    },
  };
  expect(isThemeConfigDark(config)).toBe(false);
});

test('isThemeConfigDark returns false for empty config', () => {
  expect(isThemeConfigDark({})).toBe(false);
});

test('isThemeConfigDark returns false for config with empty token object', () => {
  const config = {
    token: {},
  };
  expect(isThemeConfigDark(config)).toBe(false);
});
