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
import { theme as antdThemeImport } from 'antd-v5';
import { Theme } from './Theme';
import { AnyThemeConfig } from './types';

// Mock emotion's cache to avoid actual DOM operations
jest.mock('@emotion/cache', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({}),
}));

describe('Theme', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fromConfig', () => {
    it('creates a theme with default tokens when no config is provided', () => {
      const theme = Theme.fromConfig();

      // Verify default primary color is set
      expect(theme.theme.colorPrimary).toBe('#2893b3');

      // Verify default font family is set
      expect(theme.theme.fontFamily).toContain('Inter');

      // Verify the theme is initialized with colors
      expect(theme.theme.colors).toBeDefined();
    });

    it('creates a theme with custom tokens when provided', () => {
      const customConfig: AnyThemeConfig = {
        token: {
          colorPrimary: '#ff0000',
          fontFamily: 'CustomFont, sans-serif',
        },
      };

      const theme = Theme.fromConfig(customConfig);

      // Verify custom primary color is set
      expect(theme.theme.colorPrimary).toBe('#ff0000');

      // Verify custom font family is set
      expect(theme.theme.fontFamily).toBe('CustomFont, sans-serif');

      // But default tokens should still be preserved for unspecified values
      expect(theme.theme.colorError).toBe('#e04355');
    });

    it('creates a theme with dark mode when dark algorithm is specified', () => {
      const darkConfig: AnyThemeConfig = {
        algorithm: antdThemeImport.darkAlgorithm,
      };

      const theme = Theme.fromConfig(darkConfig);

      // Verify dark mode by using the serialized config from the public method
      const serialized = theme.toSerializedConfig();
      expect(serialized.algorithm).toBe('dark');
    });
  });

  describe('setConfig', () => {
    it('updates theme with a new configuration', () => {
      const theme = Theme.fromConfig();
      const initialPrimaryColor = theme.theme.colorPrimary;

      // Update with new config
      theme.setConfig({
        token: {
          colorPrimary: '#0000ff',
        },
      });

      // Verify the theme was updated
      expect(theme.theme.colorPrimary).toBe('#0000ff');
      expect(theme.theme.colorPrimary).not.toBe(initialPrimaryColor);
    });

    it('preserves default tokens when updating with partial config', () => {
      const theme = Theme.fromConfig();
      const initialErrorColor = theme.theme.colorError;

      // Update with new config that doesn't specify error color
      theme.setConfig({
        token: {
          colorPrimary: '#0000ff',
        },
      });

      // Verify the error color is preserved
      expect(theme.theme.colorError).toBe(initialErrorColor);
    });

    it('correctly applies algorithm changes', () => {
      const theme = Theme.fromConfig();

      // Change to dark mode via config
      theme.setConfig({
        algorithm: antdThemeImport.darkAlgorithm,
      });

      // Verify the algorithm was updated
      const serialized = theme.toSerializedConfig();
      expect(serialized.algorithm).toBe('dark');
    });
  });

  describe('toggleDarkMode', () => {
    it('switches to dark algorithm when toggling dark mode on', () => {
      const theme = Theme.fromConfig();

      // Toggle dark mode on
      theme.toggleDarkMode(true);

      // Verify dark algorithm is used
      const serialized = theme.toSerializedConfig();
      expect(serialized.algorithm).toBe('dark');
    });

    it('switches to default algorithm when toggling dark mode off', () => {
      // Start with dark theme
      const theme = Theme.fromConfig({
        algorithm: antdThemeImport.darkAlgorithm,
      });

      // Toggle dark mode off
      theme.toggleDarkMode(false);

      // Verify default algorithm is used
      const serialized = theme.toSerializedConfig();
      expect(serialized.algorithm).toBe('default');
    });

    it('preserves other algorithms when toggling dark mode', () => {
      // Start with compact and dark algorithms
      const theme = Theme.fromConfig({
        algorithm: [
          antdThemeImport.compactAlgorithm,
          antdThemeImport.darkAlgorithm,
        ],
      });

      // Toggle dark mode off
      theme.toggleDarkMode(false);

      // Verify default algorithm replaces dark but compact is preserved
      const serialized = theme.toSerializedConfig();
      expect(Array.isArray(serialized.algorithm)).toBe(true);
      expect(serialized.algorithm).toContain('default');
      expect(serialized.algorithm).toContain('compact');
      expect(serialized.algorithm).not.toContain('dark');
    });
  });

  describe('getFontSize', () => {
    it('returns correct font size for given key', () => {
      const theme = Theme.fromConfig();

      // Test different font size keys
      expect(theme.getFontSize('xs')).toBe('8');
      expect(theme.getFontSize('m')).toBeTruthy();
      expect(theme.getFontSize('xxl')).toBe('28');
    });

    it('defaults to medium font size when no key is provided', () => {
      const theme = Theme.fromConfig();
      const mediumSize = theme.getFontSize('m');

      expect(theme.getFontSize()).toBe(mediumSize);
    });
  });

  describe('toSerializedConfig', () => {
    it('serializes theme config correctly', () => {
      const theme = Theme.fromConfig({
        token: {
          colorPrimary: '#ff0000',
        },
        algorithm: antdThemeImport.darkAlgorithm,
      });

      const serialized = theme.toSerializedConfig();

      expect(serialized.token?.colorPrimary).toBe('#ff0000');
      expect(serialized.algorithm).toBe('dark');
    });
  });
});
