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
import { mergeWith } from 'lodash-es';
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
  // Merge a config over an optional base theme (arrays replace rather than
  // deep-merge; a colorPrimary override without colorLink aligns colorLink).
  private static mergeConfig(
    config?: AnyThemeConfig,
    baseTheme?: AnyThemeConfig,
  ): AnyThemeConfig | undefined {
    let mergedConfig: AnyThemeConfig | undefined = config;

    if (baseTheme && config) {
      mergedConfig = mergeWith({}, baseTheme, config, (objValue, srcValue) =>
        Array.isArray(srcValue) ? srcValue : undefined,
      );

      // In Ant Design v5, colorLink derives from colorInfo, not colorPrimary.
      // We expect links to follow the brand/primary color, so when a config
      // overrides colorPrimary without setting colorLink, align the merged
      // colorLink with the new primary palette.
      if (config.token?.colorPrimary && !config.token?.colorLink) {
        const mToken = mergedConfig?.token;
        if (mToken) {
          mToken.colorLink = mToken.colorPrimary;
        }
      }
    } else if (baseTheme && !config) {
      mergedConfig = baseTheme;
    }

    return mergedConfig;
  }

  static fromConfig(
    config?: AnyThemeConfig,
    baseTheme?: AnyThemeConfig,
  ): Theme {
    return new Theme({ config: Theme.mergeConfig(config, baseTheme) });
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
   * Update the theme using any theme configuration, optionally merged over a
   * base theme. Automatically handles both AntdThemeConfig and
   * SerializableThemeConfig. Dark mode should be specified via the algorithm
   * property in the config.
   */
  setConfig(config: AnyThemeConfig, baseTheme?: AnyThemeConfig): void {
    const mergedConfig = Theme.mergeConfig(config, baseTheme) ?? config;
    const antdConfig = normalizeThemeConfig(mergedConfig);

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

    // Extract Superset-specific properties from the merged config (not the raw
    // config) so a base theme's ECharts overrides survive in-place updates, the
    // same way the Ant Design tokens above are taken from the merged config.
    const { echartsOptionsOverrides, echartsOptionsOverridesByChartType } =
      mergedConfig as AnyThemeConfig & {
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

    // Update every mounted provider with the fully formed theme
    this.notifyProviders(
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

    // Skip the update (and the notifyProviders fan-out it triggers) if the
    // theme is already in the requested mode. Docs pages mount one
    // dark-mode-sync bridge per live component demo (see
    // docs/src/components/StorybookWrapper.jsx's ThemeSync), so a single
    // toggle event calls this once per demo on the page. Without this
    // check, every one of those calls would recompute the theme and
    // notify every mounted provider, turning a single real toggle into
    // O(n^2) provider notifications across n demos.
    // Compare the algorithm sets rather than positions: reordering
    // non-mode algorithms to the front doesn't change the effective
    // theme, so it shouldn't count as a change either.
    const currentAlgorithm = this.antdConfig.algorithm;
    const algorithmUnchanged = Array.isArray(newConfig.algorithm)
      ? Array.isArray(currentAlgorithm) &&
        newConfig.algorithm.length === currentAlgorithm.length &&
        newConfig.algorithm.every(alg => currentAlgorithm.includes(alg))
      : newConfig.algorithm === currentAlgorithm;
    if (algorithmUnchanged) {
      return;
    }

    // Update the theme with the new configuration
    this.setConfig(newConfig);
  }

  json(): string {
    return JSON.stringify(serializeThemeConfig(this.antdConfig), null, 2);
  }

  // Every currently-mounted SupersetThemeProvider for this Theme instance
  // registers a listener here (see the useEffect below). A single
  // "last write wins" callback isn't enough once more than one provider can
  // be mounted from the same Theme instance at a time -- e.g. multiple live
  // component demos on one docs page -- since each render would overwrite
  // the previous provider's callback and only the most-recently-rendered
  // provider would ever hear about a setConfig/toggleDarkMode call.
  private providerListeners = new Set<
    (
      theme: SupersetTheme,
      antdConfig: AntdThemeConfig,
      emotionCache: any,
    ) => void
  >();

  private notifyProviders(
    theme: SupersetTheme,
    antdConfig: AntdThemeConfig,
    emotionCache: any,
  ): void {
    this.providerListeners.forEach(listener =>
      listener(theme, antdConfig, emotionCache),
    );
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

    // Register (and, on unmount, deregister) this provider instance's own
    // listener rather than assigning a single shared callback on every
    // render, so every concurrently mounted provider for this Theme
    // instance receives updates, not just the last one to render.
    //
    // Use useLayoutEffect (not useEffect) so registration happens in the
    // same commit phase as any layout effect elsewhere that might call
    // setConfig/toggleDarkMode on this instance during mount (e.g. the
    // docs site's dark-mode sync in StorybookWrapper.jsx, which reads the
    // toggle and pushes it onto the singleton via a layout effect of its
    // own). Layout effects run bottom-up, so a listener registered here
    // (this component is nested inside that caller) is guaranteed to be
    // in place before an ancestor's layout effect can fire and notify it.
    // If this were a passive effect instead, an ancestor's layout effect
    // could call toggleDarkMode before this listener exists, dropping that
    // notification, and the provider would render stale until a later
    // toggle.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    React.useLayoutEffect(() => {
      const listener = (
        nextTheme: SupersetTheme,
        nextAntdConfig: AntdThemeConfig,
        nextEmotionCache: any,
      ) => {
        setThemeState({
          theme: nextTheme,
          antdConfig: nextAntdConfig,
          emotionCache: nextEmotionCache,
        });
      };
      this.providerListeners.add(listener);
      return () => {
        this.providerListeners.delete(listener);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
