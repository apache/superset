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
import { theme as antdThemeImport } from 'antd';
import { Theme } from './Theme';
import { AnyThemeConfig, ThemeAlgorithm } from './types';

// Mock emotion's cache to avoid actual DOM operations
jest.mock('@emotion/cache', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({}),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('Theme.json serializes the theme configuration to a JSON string', () => {
  const theme = Theme.fromConfig({
    token: {
      colorPrimary: '#ff0000',
    },
    algorithm: antdThemeImport.darkAlgorithm,
  });

  const jsonString = theme.json();
  const parsedJson = JSON.parse(jsonString);

  expect(parsedJson.token?.colorPrimary).toBe('#ff0000');
  expect(parsedJson.algorithm).toBe(ThemeAlgorithm.DARK);
});

test('Theme.fromConfig creates a theme with Ant Design defaults when no config is provided', () => {
  const theme = Theme.fromConfig();

  // Verify Ant Design default tokens are set
  expect(theme.theme.colorPrimary).toBeDefined();
  expect(theme.theme.fontFamily).toBeDefined();

  // Verify the theme is initialized with semantic color tokens
  expect(theme.theme.colorText).toBeDefined();
  expect(theme.theme.colorBgBase).toBeDefined();
});

test('Theme.fromConfig creates a theme with custom tokens when provided', () => {
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

  // Unspecified values will use Ant Design defaults
  expect(theme.theme.colorError).toBeDefined();
});

test('Theme.fromConfig creates a theme with dark mode when dark algorithm is specified', () => {
  const darkConfig: AnyThemeConfig = {
    algorithm: antdThemeImport.darkAlgorithm,
  };

  const theme = Theme.fromConfig(darkConfig);

  // Verify dark mode by using the serialized config from the public method
  const serialized = theme.toSerializedConfig();
  expect(serialized.algorithm).toBe(ThemeAlgorithm.DARK);
});

test('Theme.setConfig updates theme with a new configuration', () => {
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

test('Theme.setConfig preserves default tokens when updating with partial config', () => {
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

test('Theme.setConfig correctly applies algorithm changes', () => {
  const theme = Theme.fromConfig();

  // Change to dark mode via config
  theme.setConfig({
    algorithm: antdThemeImport.darkAlgorithm,
  });

  // Verify the algorithm was updated
  const serialized = theme.toSerializedConfig();
  expect(serialized.algorithm).toBe(ThemeAlgorithm.DARK);
});

test('Theme.toggleDarkMode switches to dark algorithm when toggling dark mode on', () => {
  const theme = Theme.fromConfig();

  // Toggle dark mode on
  theme.toggleDarkMode(true);

  // Verify dark algorithm is used
  const serialized = theme.toSerializedConfig();
  expect(serialized.algorithm).toBe(ThemeAlgorithm.DARK);
});

test('Theme.toggleDarkMode switches to default algorithm when toggling dark mode off', () => {
  // Start with dark theme
  const theme = Theme.fromConfig({
    algorithm: antdThemeImport.darkAlgorithm,
  });

  // Toggle dark mode off
  theme.toggleDarkMode(false);

  // Verify default algorithm is used
  const serialized = theme.toSerializedConfig();
  expect(serialized.algorithm).toBe(ThemeAlgorithm.DEFAULT);
});

test('Theme.toggleDarkMode preserves other algorithms when toggling dark mode', () => {
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
  expect(serialized.algorithm).toContain(ThemeAlgorithm.DEFAULT);
  expect(serialized.algorithm).toContain(ThemeAlgorithm.COMPACT);
  expect(serialized.algorithm).not.toContain(ThemeAlgorithm.DARK);
});

test('Theme.toSerializedConfig serializes theme config correctly', () => {
  const theme = Theme.fromConfig({
    token: {
      colorPrimary: '#ff0000',
    },
    algorithm: antdThemeImport.darkAlgorithm,
  });

  const serialized = theme.toSerializedConfig();

  expect(serialized.token?.colorPrimary).toBe('#ff0000');
  expect(serialized.algorithm).toBe(ThemeAlgorithm.DARK);
});

test('Theme.fromConfig with baseTheme applies base theme tokens under the main config', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#ff0000',
      colorError: '#00ff00',
      fontFamily: 'BaseFont',
    },
  };

  const userConfig: AnyThemeConfig = {
    token: {
      colorPrimary: '#0000ff',
    },
  };

  const theme = Theme.fromConfig(userConfig, baseTheme);

  // User config overrides base theme
  expect(theme.theme.colorPrimary).toBe('#0000ff');

  // Base theme tokens are preserved when not overridden
  expect(theme.theme.colorError).toBe('#00ff00');
  expect(theme.theme.fontFamily).toBe('BaseFont');
});

test('Theme.fromConfig with baseTheme applies base theme when no user config is provided', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#ff0000',
      fontFamily: 'TestFont',
    },
    algorithm: antdThemeImport.darkAlgorithm,
  };

  const theme = Theme.fromConfig(undefined, baseTheme);

  // Color may be transformed by dark algorithm, check fontFamily instead
  expect(theme.theme.fontFamily).toBe('TestFont');

  const serialized = theme.toSerializedConfig();
  expect(serialized.algorithm).toBe(ThemeAlgorithm.DARK);
});

test('Theme.fromConfig with baseTheme handles empty config with base theme', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#ff0000',
    },
    algorithm: antdThemeImport.defaultAlgorithm,
  };

  const emptyConfig: AnyThemeConfig = {};

  const theme = Theme.fromConfig(emptyConfig, baseTheme);

  // Base theme tokens should be applied
  expect(theme.theme.colorPrimary).toBe('#ff0000');

  const serialized = theme.toSerializedConfig();
  expect(serialized.algorithm).toBe(ThemeAlgorithm.DEFAULT);
});

test('Theme.fromConfig with baseTheme merges algorithms correctly with base theme', () => {
  const baseTheme: AnyThemeConfig = {
    algorithm: antdThemeImport.compactAlgorithm,
  };

  const userConfig: AnyThemeConfig = {
    algorithm: antdThemeImport.darkAlgorithm,
  };

  const theme = Theme.fromConfig(userConfig, baseTheme);

  // User algorithm should override base algorithm
  const serialized = theme.toSerializedConfig();
  expect(serialized.algorithm).toBe(ThemeAlgorithm.DARK);
});

test('Theme.fromConfig with baseTheme merges component overrides with base theme', () => {
  const baseTheme: AnyThemeConfig = {
    components: {
      Button: {
        colorPrimary: '#basebutton',
      },
      Input: {
        colorBorder: '#baseinput',
      },
    },
  };

  const userConfig: AnyThemeConfig = {
    components: {
      Button: {
        colorPrimary: '#userbutton',
      },
    },
  };

  const theme = Theme.fromConfig(userConfig, baseTheme);
  const serialized = theme.toSerializedConfig();

  // User component config overrides base
  expect(serialized.components?.Button?.colorPrimary).toBe('#userbutton');

  // Base component config preserved when not overridden
  expect(serialized.components?.Input?.colorBorder).toBe('#baseinput');
});

test('Theme.fromConfig with baseTheme handles undefined config and undefined base theme', () => {
  const theme = Theme.fromConfig(undefined, undefined);

  // Should get Ant Design defaults
  expect(theme.theme.colorPrimary).toBeDefined();
  expect(theme.theme.fontFamily).toBeDefined();
});

test('Theme.fromConfig with baseTheme preserves custom tokens in base theme', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#ff0000',
      // Custom superset-specific tokens
      brandLogoAlt: 'CustomLogo',
      menuHoverBackgroundColor: '#00ff00',
    } as Record<string, any>,
  };

  const theme = Theme.fromConfig({}, baseTheme);

  // Standard token
  expect(theme.theme.colorPrimary).toBe('#ff0000');

  // Custom tokens should be preserved
  expect((theme.theme as any).brandLogoAlt).toBe('CustomLogo');
  expect((theme.theme as any).menuHoverBackgroundColor).toBe('#00ff00');
});

test('Theme edge cases correctly applies base theme tokens in dark mode', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#1890ff',
      fontFamily: 'TestFont',
    },
    algorithm: antdThemeImport.defaultAlgorithm,
  };

  const baseThemeDark: AnyThemeConfig = {
    ...baseTheme,
    algorithm: antdThemeImport.darkAlgorithm,
  };

  // Simulate light mode with base theme
  const lightTheme = Theme.fromConfig({}, baseTheme);
  expect(lightTheme.theme.colorPrimary).toBe('#1890ff');
  expect(lightTheme.theme.fontFamily).toBe('TestFont');

  // Simulate dark mode with base theme dark
  const darkTheme = Theme.fromConfig({}, baseThemeDark);
  // Dark algorithm transforms colors, but fontFamily should be preserved
  expect(darkTheme.theme.fontFamily).toBe('TestFont');

  // Verify the algorithm is different
  const lightSerialized = lightTheme.toSerializedConfig();
  const darkSerialized = darkTheme.toSerializedConfig();
  expect(lightSerialized.algorithm).toBe(ThemeAlgorithm.DEFAULT);
  expect(darkSerialized.algorithm).toBe(ThemeAlgorithm.DARK);
});

test('Theme edge cases handles switching from custom theme back to base theme', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#1890ff',
    },
    algorithm: antdThemeImport.defaultAlgorithm,
  };

  // First apply custom theme
  const customConfig: AnyThemeConfig = {
    token: {
      colorPrimary: '#52c41a',
    },
  };
  const themeWithCustom = Theme.fromConfig(customConfig, baseTheme);
  expect(themeWithCustom.theme.colorPrimary).toBe('#52c41a');

  // Then switch back to empty config (simulating removal of custom theme)
  const themeWithEmpty = Theme.fromConfig({}, baseTheme);
  expect(themeWithEmpty.theme.colorPrimary).toBe('#1890ff');

  // Verify they produce different outputs
  expect(themeWithCustom.theme.colorPrimary).not.toBe(
    themeWithEmpty.theme.colorPrimary,
  );
});

test('Theme edge cases handles algorithm-only config with base theme', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      fontFamily: 'TestFont',
      borderRadius: 8,
    },
    algorithm: antdThemeImport.defaultAlgorithm,
  };

  // Config that only specifies algorithm (common for THEME_DARK)
  const algorithmOnlyConfig: AnyThemeConfig = {
    algorithm: antdThemeImport.darkAlgorithm,
  };

  const theme = Theme.fromConfig(algorithmOnlyConfig, baseTheme);

  // Should have base theme tokens
  expect(theme.theme.fontFamily).toBe('TestFont');
  expect(theme.theme.borderRadius).toBe(8);

  // Should have user's algorithm
  const serialized = theme.toSerializedConfig();
  expect(serialized.algorithm).toBe(ThemeAlgorithm.DARK);
});

test('Theme base theme integration merges base theme tokens with empty user theme', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#2893B3',
      colorError: '#e04355',
      fontFamily: 'Inter, Helvetica',
    },
  };

  const userTheme: AnyThemeConfig = {
    algorithm: antdThemeImport.defaultAlgorithm,
  };

  const theme = Theme.fromConfig(userTheme, baseTheme);

  expect(theme.theme.colorPrimary).toBe('#2893B3');
  expect(theme.theme.colorError).toBe('#e04355');
  expect(theme.theme.fontFamily).toBe('Inter, Helvetica');

  // Should have user's algorithm
  const serialized = theme.toSerializedConfig();
  expect(serialized.algorithm).toBe(ThemeAlgorithm.DEFAULT);
});

test('Theme base theme integration allows user theme to override specific base theme tokens', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#2893B3',
      colorError: '#e04355',
      fontFamily: 'Inter, Helvetica',
      borderRadius: 4,
    },
  };

  const userTheme: AnyThemeConfig = {
    algorithm: antdThemeImport.defaultAlgorithm,
    token: {
      colorPrimary: '#123456', // Override primary color
      // Leave other tokens from base
    },
  };

  const theme = Theme.fromConfig(userTheme, baseTheme);

  // User override should win
  expect(theme.theme.colorPrimary).toBe('#123456');

  // Base theme tokens should be preserved
  expect(theme.theme.colorError).toBe('#e04355');
  expect(theme.theme.fontFamily).toBe('Inter, Helvetica');
  expect(theme.theme.borderRadius).toBe(4);
});

test('Theme base theme integration handles base theme with dark algorithm correctly', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#2893B3',
      fontFamily: 'Inter, Helvetica',
    },
  };

  const baseThemeDark: AnyThemeConfig = {
    ...baseTheme,
    algorithm: antdThemeImport.darkAlgorithm,
  };

  const userDarkTheme: AnyThemeConfig = {
    algorithm: antdThemeImport.darkAlgorithm,
  };

  const theme = Theme.fromConfig(userDarkTheme, baseThemeDark);

  // Should have base tokens
  expect(theme.theme.fontFamily).toBe('Inter, Helvetica');

  // Should be in dark mode
  const serialized = theme.toSerializedConfig();
  expect(serialized.algorithm).toBe(ThemeAlgorithm.DARK);
});

test('Theme base theme integration works with real-world Superset base theme configuration', () => {
  // Simulate actual Superset base theme (THEME_DEFAULT/THEME_DARK from config)
  const supersetBaseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#2893B3',
      colorError: '#e04355',
      colorWarning: '#fcc700',
      colorSuccess: '#5ac189',
      colorInfo: '#66bcfe',
      fontFamily: "'Inter', Helvetica, Arial",
      fontFamilyCode: "'IBM Plex Mono', 'Courier New', monospace",
    },
  };

  // Simulate THEME_DEFAULT from config
  const themeDefault: AnyThemeConfig = {
    algorithm: antdThemeImport.defaultAlgorithm,
  };

  // Simulate THEME_DARK from config
  const themeDark: AnyThemeConfig = {
    algorithm: antdThemeImport.darkAlgorithm,
  };

  // Test light mode
  const lightTheme = Theme.fromConfig(themeDefault, supersetBaseTheme);
  expect(lightTheme.theme.colorPrimary).toBe('#2893B3');
  expect(lightTheme.theme.fontFamily).toBe("'Inter', Helvetica, Arial");

  // Test dark mode
  const darkTheme = Theme.fromConfig(themeDark, {
    ...supersetBaseTheme,
    algorithm: antdThemeImport.darkAlgorithm,
  });
  expect(darkTheme.theme.fontFamily).toBe("'Inter', Helvetica, Arial");

  const darkSerialized = darkTheme.toSerializedConfig();
  expect(darkSerialized.algorithm).toBe(ThemeAlgorithm.DARK);
});

test('Theme base theme integration handles component overrides in base theme', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#2893B3',
    },
    components: {
      Button: {
        primaryColor: '#custom-button',
        borderRadius: 8,
      },
    },
  };

  const userTheme: AnyThemeConfig = {
    algorithm: antdThemeImport.defaultAlgorithm,
  };

  const theme = Theme.fromConfig(userTheme, baseTheme);

  // Should preserve component overrides
  const serialized = theme.toSerializedConfig();
  expect(serialized.components?.Button?.primaryColor).toBe('#custom-button');
  expect(serialized.components?.Button?.borderRadius).toBe(8);
});

test('Theme base theme integration properly handles algorithm property override', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#2893B3',
    },
    algorithm: antdThemeImport.defaultAlgorithm,
  };

  const userTheme: AnyThemeConfig = {
    algorithm: antdThemeImport.darkAlgorithm,
    token: {
      borderRadius: 8,
    },
  };

  const theme = Theme.fromConfig(userTheme, baseTheme);
  const serialized = theme.toSerializedConfig();

  // User algorithm should override base algorithm
  expect(serialized.algorithm).toBe(ThemeAlgorithm.DARK);

  // Both base and user tokens should be merged
  expect(serialized.token?.colorPrimary).toBeTruthy();
  expect(serialized.token?.borderRadius).toBe(8);
});

test('Theme base theme integration handles cssVar, hashed and inherit properties correctly', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#2893B3',
    },
    cssVar: true,
    hashed: false,
  };

  const userTheme: AnyThemeConfig = {
    token: {
      borderRadius: 8,
    },
    inherit: true,
  };

  const theme = Theme.fromConfig(userTheme, baseTheme);
  const serialized = theme.toSerializedConfig();

  // User properties override/add to base
  expect(serialized.inherit).toBe(true);
  expect(serialized.cssVar).toBe(true);
  expect(serialized.hashed).toBe(false);

  // Tokens are still merged
  expect(serialized.token?.colorPrimary).toBeTruthy();
  expect(serialized.token?.borderRadius).toBe(8);
});

test('Theme base theme integration merges nested component styles correctly', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#2893B3',
      fontFamily: 'BaseFont',
    },
    components: {
      Button: {
        colorPrimary: '#basebutton',
        fontSize: 14,
      },
      Input: {
        colorBorder: '#baseinput',
      },
    },
  };

  const userTheme: AnyThemeConfig = {
    token: {
      borderRadius: 8,
    },
    components: {
      Button: {
        fontSize: 16, // Override Button fontSize
      },
      Select: {
        colorBorder: '#userselect', // Add new component
      },
    },
  };

  const theme = Theme.fromConfig(userTheme, baseTheme);
  const serialized = theme.toSerializedConfig();

  // Tokens should be merged
  // Note: components present may affect color transformation
  expect(serialized.token?.colorPrimary).toBeTruthy();
  expect(serialized.token?.borderRadius).toBe(8);
  expect(serialized.token?.fontFamily).toBe('BaseFont');

  // Components should be merged (shallow merge per component)
  expect(serialized.components?.Button?.colorPrimary).toBe('#basebutton');
  expect(serialized.components?.Button?.fontSize).toBe(16); // User override
  expect(serialized.components?.Input?.colorBorder).toBe('#baseinput');
  expect(serialized.components?.Select?.colorBorder).toBe('#userselect');
});

test('Theme base theme integration setConfig replaces theme config entirely (does not preserve base theme)', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#2893B3',
      fontFamily: 'Inter',
    },
  };

  const theme = Theme.fromConfig({}, baseTheme);

  expect(theme.theme.colorPrimary).toBe('#2893B3');
  expect(theme.theme.fontFamily).toBe('Inter');

  // Update config (simulating theme change)
  theme.setConfig({
    token: {
      colorPrimary: '#654321',
    },
    algorithm: antdThemeImport.darkAlgorithm,
  });

  // setConfig replaces the entire config, so base theme is NOT preserved
  // This is expected behavior - setConfig is for complete replacement
  expect(theme.theme.colorPrimary).toBeTruthy();
  // fontFamily reverts to Ant Design default since base theme is not reapplied
  expect(theme.theme.fontFamily).not.toBe('Inter');
});

test('Theme base theme integration minimal theme preserves ALL base theme tokens except overridden ones', () => {
  // Simulate a comprehensive base theme with many tokens
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#2893B3',
      colorError: '#e04355',
      colorWarning: '#fcc700',
      colorSuccess: '#5ac189',
      colorInfo: '#66bcfe',
      fontFamily: 'Inter, Helvetica',
      fontSize: 14,
      borderRadius: 4,
      lineWidth: 1,
      controlHeight: 32,
      // Custom Superset tokens
      brandLogoAlt: 'CustomLogo',
      menuHoverBackgroundColor: '#eeeeee',
    } as Record<string, any>,
    algorithm: antdThemeImport.defaultAlgorithm,
  };

  // Minimal theme that only overrides primary color and algorithm
  const minimalTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#ff05dd', // Only override this
    },
    algorithm: antdThemeImport.darkAlgorithm, // Change to dark
  };

  const theme = Theme.fromConfig(minimalTheme, baseTheme);

  // User's override should apply
  expect(theme.theme.colorPrimary).toBe('#ff05dd');

  // ALL base theme tokens should be preserved
  expect(theme.theme.colorError).toBe('#e04355');
  expect(theme.theme.colorWarning).toBe('#fcc700');
  expect(theme.theme.colorSuccess).toBe('#5ac189');
  expect(theme.theme.colorInfo).toBe('#66bcfe');
  expect(theme.theme.fontFamily).toBe('Inter, Helvetica');
  expect(theme.theme.fontSize).toBe(14);
  expect(theme.theme.borderRadius).toBe(4);
  expect(theme.theme.lineWidth).toBe(1);
  expect(theme.theme.controlHeight).toBe(32);

  // Custom tokens should also be preserved
  expect((theme.theme as any).brandLogoAlt).toBe('CustomLogo');
  expect((theme.theme as any).menuHoverBackgroundColor).toBe('#eeeeee');

  // Algorithm should be updated
  const serialized = theme.toSerializedConfig();
  expect(serialized.algorithm).toBe(ThemeAlgorithm.DARK);
});

test('Theme base theme integration arrays in themes are replaced entirely, not merged by index', () => {
  const baseTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#2893B3',
    },
    algorithm: [
      antdThemeImport.compactAlgorithm,
      antdThemeImport.defaultAlgorithm,
    ],
  };

  const userTheme: AnyThemeConfig = {
    algorithm: [antdThemeImport.darkAlgorithm], // Replace with single item array
  };

  const theme = Theme.fromConfig(userTheme, baseTheme);
  const serialized = theme.toSerializedConfig();

  // User's array should completely replace base array
  expect(Array.isArray(serialized.algorithm)).toBe(true);
  expect(serialized.algorithm).toHaveLength(1);
  expect(serialized.algorithm).toContain(ThemeAlgorithm.DARK);
  expect(serialized.algorithm).not.toContain(ThemeAlgorithm.COMPACT);
  expect(serialized.algorithm).not.toContain(ThemeAlgorithm.DEFAULT);
});
