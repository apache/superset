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
/* eslint-disable react-prefer-function-component/react-prefer-function-component */
// eslint-disable-next-line no-restricted-syntax
import React from 'react';
import { theme as antdThemeImport, ConfigProvider } from 'antd-v5';
import tinycolor from 'tinycolor2';

import {
  ThemeProvider as EmotionThemeProvider,
  CacheProvider as EmotionCacheProvider,
} from '@emotion/react';
import createCache from '@emotion/cache';

import {
  AntdThemeConfig,
  AnyThemeConfig,
  SerializableThemeConfig,
  SupersetTheme,
  allowedAntdTokens,
  SharedAntdTokens,
  ColorVariants,
  DeprecatedThemeColors,
  FontSizeKey,
} from './types';

import {
  normalizeThemeConfig,
  serializeThemeConfig,
  getSystemColors,
  getDeprecatedColors,
} from './utils';

/* eslint-disable theme-colors/no-literal-colors */

export class Theme {
  theme: SupersetTheme;

  private static readonly defaultTokens = {
    // Default colors
    colorPrimary: '#2893B3', // NOTE: previous lighter primary color was #20a7c9
    colorError: '#e04355',
    colorWarning: '#fcc700',
    colorSuccess: '#5ac189',
    colorInfo: '#66bcfe',

    // Forcing some default tokens
    fontFamily: `'Inter', Helvetica, Arial`,
    fontFamilyCode: `'Fira Code', 'Courier New', monospace`,

    // Extra tokens
    transitionTiming: 0.3,
    brandIconMaxWidth: 37,
    fontSizeXS: '8',
    fontSizeXXL: '28',
    fontWeightNormal: '400',
    fontWeightLight: '300',
    fontWeightMedium: '500',
  };

  private antdConfig: AntdThemeConfig;

  private static readonly sizeMap: Record<FontSizeKey, string> = {
    xs: 'fontSizeXS',
    s: 'fontSizeSM',
    m: 'fontSize',
    l: 'fontSizeLG',
    xl: 'fontSizeXL',
    xxl: 'fontSizeXXL',
  };

  private constructor({ config }: { config?: AnyThemeConfig }) {
    this.SupersetThemeProvider = this.SupersetThemeProvider.bind(this);

    // Create a new config object with default tokens
    const newConfig: AnyThemeConfig = config ? { ...config } : {};

    // Ensure token property exists with defaults
    newConfig.token = {
      ...Theme.defaultTokens,
      ...(config?.token || {}),
    };

    this.setConfig(newConfig);
  }

  /**
   * Create a theme from any theme configuration
   * Automatically handles both AntdThemeConfig and SerializableThemeConfig
   * If simple tokens are provided as { token: {...} }, they will be applied with defaults
   * If no config is provided, uses default tokens
   * Dark mode can be set via the algorithm property in the config
   */
  static fromConfig(config?: AnyThemeConfig): Theme {
    return new Theme({ config });
  }

  private static getFilteredAntdTheme(
    antdConfig: AntdThemeConfig,
  ): SharedAntdTokens {
    // This method generates all antd tokens and filters out the ones not allowed
    // in Superset
    const theme = Theme.getAntdTokens(antdConfig);
    return Object.fromEntries(
      allowedAntdTokens.map(key => [key, (theme as Record<string, any>)[key]]),
    ) as SharedAntdTokens;
  }

  private static getAntdTokens(
    antdConfig: AntdThemeConfig,
  ): Record<string, any> {
    return antdThemeImport.getDesignToken(antdConfig);
  }

  /**
   * Update the theme using any theme configuration
   * Automatically handles both AntdThemeConfig and SerializableThemeConfig
   * Dark mode should be specified via the algorithm property in the config
   */
  setConfig(config: AnyThemeConfig): void {
    const antdConfig = normalizeThemeConfig(config);

    // Apply default tokens to token property
    antdConfig.token = {
      ...Theme.defaultTokens,
      ...(antdConfig.token || {}),
    };

    // First phase: Let Ant Design compute the tokens
    const tokens = Theme.getFilteredAntdTheme(antdConfig);

    // Set the base theme properties
    this.antdConfig = antdConfig;
    this.theme = {
      ...Theme.defaultTokens,
      ...antdConfig.token, // Passing through the extra, superset-specific tokens
      ...tokens,
      colors: {} as DeprecatedThemeColors, // Placeholder that will be filled in the second phase
    };

    // Second phase: Now that theme is initialized, we can determine if it's dark
    // and generate the legacy colors correctly
    const systemColors = getSystemColors(tokens);
    const isDark = this.isThemeDark(); // Now we can safely call this
    this.theme.colors = getDeprecatedColors(systemColors, isDark);

    // Update the providers with the fully formed theme
    this.updateProviders(
      this.theme,
      this.antdConfig,
      createCache({ key: 'superset' }),
    );
  }

  /**
   * Export the current theme as a serializable configuration
   */
  toSerializedConfig(): SerializableThemeConfig {
    return serializeThemeConfig(this.antdConfig);
  }

  private getToken(token: string): any {
    return (this.theme as Record<string, any>)[token];
  }

  public getFontSize(size?: FontSizeKey): string {
    const fontSizeKey = Theme.sizeMap[size || 'm'];
    return this.getToken(fontSizeKey) || this.getToken('fontSize');
  }

  /**
   * Check if the current theme is dark based on background color
   */
  isThemeDark(): boolean {
    return tinycolor(this.theme.colorBgContainer).isDark();
  }

  toggleDarkMode(isDark: boolean): void {
    // Create a new config based on the current one
    const newConfig = { ...this.antdConfig };

    // Determine the new algorithm based on isDark
    const newAlgorithm = isDark
      ? antdThemeImport.darkAlgorithm
      : antdThemeImport.defaultAlgorithm;

    // Handle the case where algorithm is an array
    if (Array.isArray(newConfig.algorithm)) {
      // Filter out any existing dark/default algorithms
      const otherAlgorithms = newConfig.algorithm.filter(
        alg =>
          alg !== antdThemeImport.darkAlgorithm &&
          alg !== antdThemeImport.defaultAlgorithm,
      );

      // Add the new algorithm to the front of the array
      newConfig.algorithm = [newAlgorithm, ...otherAlgorithms];
    } else {
      // Simple case: just replace the algorithm
      newConfig.algorithm = newAlgorithm;
    }

    // Update the theme with the new configuration
    this.setConfig(newConfig);
  }

  json(): string {
    return JSON.stringify(serializeThemeConfig(this.antdConfig), null, 2);
  }

  getColorVariants(color: string): ColorVariants {
    const firstLetterCapped = color.charAt(0).toUpperCase() + color.slice(1);
    if (color === 'default' || color === 'grayscale') {
      const isDark = this.isThemeDark();

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

    const theme = this.getToken.bind(this);
    return {
      active: theme(`color${firstLetterCapped}Active`),
      textActive: theme(`color${firstLetterCapped}TextActive`),
      text: theme(`color${firstLetterCapped}Text`),
      textHover: theme(`color${firstLetterCapped}TextHover`),
      hover: theme(`color${firstLetterCapped}Hover`),
      borderHover: theme(`color${firstLetterCapped}BorderHover`),
      border: theme(`color${firstLetterCapped}Border`),
      bgHover: theme(`color${firstLetterCapped}BgHover`),
      bg: theme(`color${firstLetterCapped}Bg`),
    };
  }

  private updateProviders(
    theme: SupersetTheme,
    antdConfig: AntdThemeConfig,
    emotionCache: any,
  ): void {
    // Overridden at runtime by SupersetThemeProvider using setThemeState
  }

  SupersetThemeProvider({ children }: { children: React.ReactNode }) {
    if (!this.theme || !this.antdConfig) {
      throw new Error('Theme is not initialized.');
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [themeState, setThemeState] = React.useState({
      theme: this.theme,
      antdConfig: this.antdConfig,
      emotionCache: createCache({ key: 'superset' }),
    });

    this.updateProviders = (theme, antdConfig, emotionCache) => {
      setThemeState({ theme, antdConfig, emotionCache });
    };

    return (
      <EmotionCacheProvider value={themeState.emotionCache}>
        <EmotionThemeProvider theme={themeState.theme}>
          <ConfigProvider theme={themeState.antdConfig} prefixCls="antd5">
            {children}
          </ConfigProvider>
        </EmotionThemeProvider>
      </EmotionCacheProvider>
    );
  }
}

/* eslint-enable theme-colors/no-literal-colors */
