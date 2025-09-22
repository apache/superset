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
import { noop } from 'lodash';
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

export class Theme {
  theme: SupersetTheme;

  private antdConfig: AntdThemeConfig;

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
      mergedConfig = {
        ...baseTheme,
        ...config,
      } as AnyThemeConfig;

      if (baseTheme.token || config.token) {
        (mergedConfig as any).token = {
          ...(baseTheme.token || {}),
          ...(config.token || {}),
        };
      }

      if (baseTheme.components || config.components) {
        const mergedComponents: any = { ...(baseTheme.components || {}) };

        if (config.components) {
          const configComponents = config.components as any;
          Object.keys(configComponents).forEach(componentName => {
            mergedComponents[componentName] = {
              ...(mergedComponents[componentName] || {}),
              ...configComponents[componentName],
            };
          });
        }

        (mergedConfig as any).components = mergedComponents;
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

    // First phase: Let Ant Design compute the tokens
    const tokens = Theme.getFilteredAntdTheme(antdConfig);

    // Set the base theme properties
    this.antdConfig = antdConfig;
    this.theme = {
      ...tokens, // First apply Ant Design computed tokens
      ...(antdConfig.token || {}), // Then override with our custom tokens
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
