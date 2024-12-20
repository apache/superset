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
import { render, screen } from '@testing-library/react';
import { theme as antdThemeImport } from 'antd-v5';
import { Theme } from './Theme';
import { serializeThemeConfig } from './utils';
import { AnyThemeConfig } from './types';

// Mock emotion's cache to avoid actual DOM operations
jest.mock('@emotion/cache', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({}),
}));

// Helper to test theme rendering
const TestComponent = ({ theme }: { theme: Theme }) => {
  if (!theme?.SupersetThemeProvider) {
    throw new Error('SupersetThemeProvider is not initialized');
  }

  return (
    <theme.SupersetThemeProvider>
      <div data-testid="themed-component">Themed Component</div>
    </theme.SupersetThemeProvider>
  );
};

describe('Theme', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fromConfig', () => {
    it('creates a theme with default tokens when no config is provided', () => {
      const theme = Theme.fromConfig();

      // Verify default primary color is set
      expect(theme.theme.colorPrimary.toLowerCase()).toBe('#20a7c9');

      // Verify default font family is set
      expect(theme.theme.fontFamily).toContain('Inter');

      // Verify the theme is initialized with colors
      expect(theme.theme.colors).toBeDefined();
    });

    it('creates a theme with custom tokens when provided', () => {
      const customConfig: AnyThemeConfig = {
        token: {
          colorPrimary: '#FF0000',
          fontFamily: 'CustomFont, sans-serif',
        },
      };

      const theme = Theme.fromConfig(customConfig);

      // Verify custom primary color is set
      expect(theme.theme.colorPrimary.toLowerCase()).toBe('#ff0000');

      // Verify custom font family is set
      expect(theme.theme.fontFamily).toBe('CustomFont, sans-serif');

      // But default tokens should still be preserved for unspecified values
      expect(theme.theme.colorError.toLowerCase()).toBe('#e04355');
    });

    it('creates a theme with dark mode when dark algorithm is specified', () => {
      const darkConfig: AnyThemeConfig = {
        algorithm: antdThemeImport.darkAlgorithm,
      };

      const theme = Theme.fromConfig(darkConfig);

      // Verify the algorithm is set to dark
      const serialized = serializeThemeConfig(theme.antdConfig);
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
          colorPrimary: '#0000FF',
        },
      });

      // Verify the theme was updated
      expect(theme.theme.colorPrimary.toLowerCase()).toBe('#0000ff');
      expect(theme.theme.colorPrimary.toLowerCase()).not.toBe(
        initialPrimaryColor.toLowerCase(),
      );
    });

    it('preserves default tokens when updating with partial config', () => {
      const theme = Theme.fromConfig();
      const initialErrorColor = theme.theme.colorError;

      // Update with new config that doesn't specify error color
      theme.setConfig({
        token: {
          colorPrimary: '#0000FF',
        },
      });

      // Verify the error color is preserved
      expect(theme.theme.colorError.toLowerCase()).toBe(
        initialErrorColor.toLowerCase(),
      );
    });

    it('correctly applies algorithm changes', () => {
      const theme = Theme.fromConfig();

      // Change to dark mode via config
      theme.setConfig({
        algorithm: antdThemeImport.darkAlgorithm,
      });

      // Verify the algorithm was updated
      const serialized = serializeThemeConfig(theme.antdConfig);
      expect(serialized.algorithm).toBe('dark');
    });
  });
});
