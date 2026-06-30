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
import { theme as antdThemeImport, ConfigProvider } from 'antd';
import {
  ThemeProvider,
  CacheProvider as EmotionCacheProvider,
} from '@emotion/react';
import createCache from '@emotion/cache';
import { noop, mergeWith } from 'lodash-es';
import tinycolor from 'tinycolor2';
import { GlobalStyles } from './GlobalStyles';
import {
  AntdThemeConfig,
  AnyThemeConfig,
  SerializableThemeConfig,
  SupersetTheme,
  allowedAntdTokens,
  SharedAntdTokens,
} from './types';
import { normalizeThemeConfig, serializeThemeConfig } from './utils';

/**
 * WCAG 1.4.3 helper — given a foreground color and the background it will sit
 * on, return a color with at least `targetRatio` contrast against the
 * background. If the input already meets the ratio it is returned unchanged.
 *
 * Used when Superset derives `colorLink` automatically from `colorPrimary`:
 * brand-saturation primary colors (e.g. Superset's default `#20A7C9`) often
 * fall below the 4.5:1 ratio that WCAG 1.4.3 requires for normal-size text,
 * so the link tokens have to be nudged toward the background's opposite end
 * before being handed to Ant Design / Emotion.
 */
function ensureLinkContrast(
  color: string,
  background: string,
  targetRatio = 4.5,
): string {
  let current = tinycolor(color);
  const bg = tinycolor(background);
  if (!current.isValid() || !bg.isValid()) return color;
  if (tinycolor.readability(current, bg) >= targetRatio) return color;

  // Light backgrounds → darken the link; dark backgrounds → lighten it. Iterate
  // in 4% HSL-lightness steps and bail out after 25 rounds to keep the result
  // recognizably the same hue rather than collapsing to pure black/white.
  const adjustDown = bg.getLuminance() > 0.5;
  for (let i = 0; i < 25; i += 1) {
    current = adjustDown
      ? current.clone().darken(4)
      : current.clone().lighten(4);
    if (tinycolor.readability(current, bg) >= targetRatio) {
      return current.toHexString();
    }
  }
  return current.toHexString();
}

export class Theme {
  // Forward-compat: TS 6.0 enforces strictPropertyInitialization here;
  // both fields are assigned via setConfig() during construction, so we
  // use a definite-assignment assertion rather than hoisting the logic
  // out of setConfig().
  //
  // Assigned via setConfig() in the constructor; TypeScript 6.0's
  // strictPropertyInitialization can't trace that call chain, so we use
  // a definite-assignment assertion.
  theme!: SupersetTheme;

  private antdConfig!: AntdThemeConfig;

  private constructor({ config }: { config?: AnyThemeConfig }) {
    this.SupersetThemeProvider = this.SupersetThemeProvider.bind(this);
    this.setConfig(config || {});
  }

  /**
   * Create a theme from any theme configuration
   * Automatically handles both AntdThemeConfig and SerializableThemeConfig
   * If simple tokens are provided as { token: {...} }, they will be applied with defaults
   * If no config is provided, uses default tokens
   * Dark mode can be set via the algorithm property in the config
   * @param config - The theme configuration
   * @param baseTheme - Optional base theme to apply under the config
   */
  static fromConfig(
    config?: AnyThemeConfig,
    baseTheme?: AnyThemeConfig,
  ): Theme {
    let mergedConfig: AnyThemeConfig | undefined = config;

    if (baseTheme && config) {
      mergedConfig = mergeWith({}, baseTheme, config, (objValue, srcValue) =>
        Array.isArray(srcValue) ? srcValue : undefined,
      );

      // In Ant Design v5, colorLink derives from colorInfo, not colorPrimary.
      // Superset expects links to follow the brand/primary color. When the user
      // overrides colorPrimary without explicitly setting colorLink, update the
      // merged colorLink so links match the new primary palette.
      if (config.token?.colorPrimary && !config.token?.colorLink) {
        const mToken = mergedConfig?.token;
        if (mToken) {
          mToken.colorLink = mToken.colorPrimary;
        }
      }
    } else if (baseTheme && !config) {
      mergedConfig = baseTheme;
    }

    return new Theme({ config: mergedConfig });
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

    if (antdConfig.token?.colorPrimary && !antdConfig.token?.colorLink) {
      antdConfig.token.colorLink = antdConfig.token.colorPrimary;
    }

    // First phase: Let Ant Design compute the tokens
    const tokens = Theme.getFilteredAntdTheme(antdConfig);

    // WCAG 1.4.3: when the caller supplies no brand color at all, Ant Design's
    // own default `colorLink = #1677ff` sits at ~4.32:1 against white — below
    // the 4.5:1 normal-text threshold. Nudge the link tokens into compliance
    // only in that "neither colorPrimary nor colorLink was supplied" path, so
    // explicit brand colors keep the exact value the caller picked. Deployments
    // that intentionally pass a low-contrast brand colorPrimary keep their
    // brand fidelity; the WCAG guarantee here applies to the *default* Superset
    // theme rather than to operator-customized themes.
    const callerSetLinkOrPrimary =
      !!(config as AnyThemeConfig)?.token?.colorLink ||
      !!(config as AnyThemeConfig)?.token?.colorPrimary;
    if (!callerSetLinkOrPrimary) {
      const bg = (tokens.colorBgContainer as string) || 'white';
      tokens.colorLink = ensureLinkContrast(tokens.colorLink as string, bg);
      tokens.colorLinkHover = ensureLinkContrast(
        tokens.colorLinkHover as string,
        bg,
      );
      tokens.colorLinkActive = ensureLinkContrast(
        tokens.colorLinkActive as string,
        bg,
      );
    }

    // Extract Superset-specific properties from top-level config.
    // These are custom properties that aren't part of Ant Design's token system
    // but need to be passed through to the SupersetTheme for ECharts customization.
    const { echartsOptionsOverrides, echartsOptionsOverridesByChartType } =
      config as AnyThemeConfig & {
        echartsOptionsOverrides?: any;
        echartsOptionsOverridesByChartType?: Record<string, any>;
      };

    // Set the base theme properties
    this.antdConfig = antdConfig;
    this.theme = {
      ...tokens, // First apply Ant Design computed tokens
      ...antdConfig.token, // Then override with our custom tokens
      // Include Superset-specific properties from top-level config
      ...(echartsOptionsOverrides && { echartsOptionsOverrides }),
      ...(echartsOptionsOverridesByChartType && {
        echartsOptionsOverridesByChartType,
      }),
    } as SupersetTheme;

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

  private updateProviders(
    theme: SupersetTheme,
    antdConfig: AntdThemeConfig,
    emotionCache: any,
  ): void {
    noop(theme, antdConfig, emotionCache);
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
        <ThemeProvider theme={themeState.theme}>
          <GlobalStyles />
          <ConfigProvider theme={themeState.antdConfig}>
            {children}
          </ConfigProvider>
        </ThemeProvider>
      </EmotionCacheProvider>
    );
  }
}
