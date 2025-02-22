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
import {
  theme as antdThemeImport,
  ThemeConfig as AntdThemeConfig,
  ConfigProvider,
} from 'antd-v5';
import tinycolor from 'tinycolor2';

import {
  ThemeProvider as EmotionThemeProvider,
  CacheProvider as EmotionCacheProvider,
} from '@emotion/react';
import createCache from '@emotion/cache';
// import { merge } from 'lodash';

import {
  AntdTokens,
  SupersetTheme,
  allowedAntdTokens,
  SharedAntdTokens,
  SystemColors,
  ColorVariants,
  DeprecatedColorVariations,
  DeprecatedThemeColors,
  LegacySupersetTheme,
  FontSizeKey,
} from './types';

/* eslint-disable theme-colors/no-literal-colors */

export class Theme {
  theme: SupersetTheme;

  private static readonly defaultTokens = {
    // Default colors
    colorPrimary: '#20a7c9',
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

  private constructor({
    seed,
    antdConfig,
    isDark = false,
  }: {
    seed?: Partial<SupersetTheme>;
    antdConfig?: AntdThemeConfig;
    isDark?: boolean;
  }) {
    this.updateTheme = this.updateTheme.bind(this);
    this.SupersetThemeProvider = this.SupersetThemeProvider.bind(this);

    if (seed && antdConfig) {
      throw new Error('Pass either theme or antdConfig, not both.');
    } else if (antdConfig) {
      this.setThemeFromAntdConfig(antdConfig);
    } else if (seed) {
      this.setThemeFromSeed(seed || {}, isDark);
    }
  }

  static fromSeed(seed?: Partial<SupersetTheme>, isDark = false): Theme {
    const theme = new Theme({ seed, isDark });
    return theme;
  }

  static fromAntdConfig(antdConfig: AntdThemeConfig): Theme {
    const theme = new Theme({ antdConfig });
    return theme;
  }

  private static genDeprecatedColorVariations(
    color: string,
    isDark: boolean,
  ): DeprecatedColorVariations {
    const bg = isDark ? '#FFF' : '#000';
    const fg = isDark ? '#000' : '#FFF';
    const adjustColor = (c: string, perc: number, tgt: string): string =>
      tinycolor.mix(c, tgt, perc).toHexString();
    return {
      base: color,
      light1: adjustColor(color, 20, fg),
      light2: adjustColor(color, 45, fg),
      light3: adjustColor(color, 70, fg),
      light4: adjustColor(color, 90, fg),
      light5: adjustColor(color, 95, fg),
      dark1: adjustColor(color, 10, bg),
      dark2: adjustColor(color, 20, bg),
      dark3: adjustColor(color, 40, bg),
      dark4: adjustColor(color, 60, bg),
      dark5: adjustColor(color, 80, bg),
    };
  }

  private static getColors(
    systemColors: SystemColors,
    isDark: boolean,
  ): DeprecatedThemeColors {
    /* This method provides a set of color variations based on the system colors.
     * Goal is to deprecate usage of these in the future
     */
    const sc = systemColors;
    return {
      primary: Theme.genDeprecatedColorVariations(sc.colorPrimary, isDark),
      error: Theme.genDeprecatedColorVariations(sc.colorError, isDark),
      warning: Theme.genDeprecatedColorVariations(sc.colorWarning, isDark),
      success: Theme.genDeprecatedColorVariations(sc.colorSuccess, isDark),
      info: Theme.genDeprecatedColorVariations(sc.colorInfo, isDark),
      grayscale: Theme.genDeprecatedColorVariations('#666', isDark),
    };
  }

  private static augmentSeedWithDefaults(
    seed: Partial<SupersetTheme>,
  ): Partial<SupersetTheme> {
    return {
      ...Theme.defaultTokens,
      ...seed,
    };
  }

  private static getSystemColors(antdTokens: SharedAntdTokens): SystemColors {
    return {
      colorPrimary: antdTokens.colorPrimary,
      colorError: antdTokens.colorError,
      colorWarning: antdTokens.colorWarning,
      colorSuccess: antdTokens.colorSuccess,
      colorInfo: antdTokens.colorInfo,
    };
  }

  private static getSupersetTheme(
    seed: Partial<SupersetTheme>,
    isDark = false,
  ): SupersetTheme {
    const antdConfig = Theme.getAntdConfig(seed, isDark);
    const antdTokens = Theme.getFilteredAntdTheme(antdConfig);
    const systemColors = Theme.getSystemColors(antdTokens);

    const theme: SupersetTheme = {
      colors: Theme.getColors(systemColors, isDark),
      ...Theme.defaultTokens,
      ...antdTokens,
    };
    return theme;
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

  private static getAntdConfig(
    seed: Partial<SupersetTheme>,
    isDark: boolean,
  ): AntdThemeConfig {
    const algorithm = isDark
      ? antdThemeImport.darkAlgorithm
      : antdThemeImport.defaultAlgorithm;
    return {
      token: seed,
      algorithm,
    };
  }

  mergeTheme(partialTheme: Partial<LegacySupersetTheme>): void {
    // const mergedTheme = merge({}, this.theme, partialTheme);
    // const isDark = tinycolor(mergedTheme.colorBgBase).isDark();
    // const antdConfig = Theme.getAntdConfig(systemColors, isDark);
    // this.updateTheme(mergedTheme, antdConfig, isDark);
  }

  private updateTheme(theme: SupersetTheme, antdConfig: AntdThemeConfig): void {
    this.theme = theme;
    this.antdConfig = antdConfig;
    this.updateProviders(
      this.theme,
      this.antdConfig,
      createCache({ key: 'superset' }),
    );
  }

  private getToken(token: string): any {
    return (this.theme as Record<string, any>)[token];
  }

  public getFontSize(size?: FontSizeKey): string {
    const fontSizeKey = Theme.sizeMap[size || 'm'];
    return this.getToken(fontSizeKey) || this.getToken('fontSize');
  }

  private static getAntdTokens(antdConfig: AntdThemeConfig): AntdTokens {
    return antdThemeImport.getDesignToken(antdConfig);
  }

  private isThemeDark(): boolean {
    return tinycolor(this.theme.colorBgContainer).isDark();
  }

  setThemeFromSeed(seed: Partial<SupersetTheme>, isDark: boolean): void {
    const augmentedSeed = Theme.augmentSeedWithDefaults(seed);
    const theme = Theme.getSupersetTheme(augmentedSeed, isDark);
    const antdConfig = Theme.getAntdConfig(augmentedSeed, isDark);
    this.updateTheme(theme, antdConfig);
  }

  setThemeFromAntdConfig(antdConfig: AntdThemeConfig): void {
    this.antdConfig = antdConfig;
    const tokens = Theme.getFilteredAntdTheme(antdConfig);
    const systemColors = Theme.getSystemColors(tokens);
    const isDark = this.isThemeDark();

    this.theme = {
      colors: Theme.getColors(systemColors, isDark),
      ...Theme.defaultTokens,
      ...tokens,
    };
    this.updateProviders(
      this.theme,
      this.antdConfig,
      createCache({ key: 'superset' }),
    );
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
