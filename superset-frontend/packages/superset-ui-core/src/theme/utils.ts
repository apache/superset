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
import tinycolor from 'tinycolor2';
import {
  type AntdThemeConfig,
  type AnyThemeConfig,
  type SerializableThemeConfig,
  type DeprecatedColorVariations,
  type DeprecatedThemeColors,
  type SystemColors,
  type SupersetTheme,
  type ThemeAlgorithmCombination,
  ThemeMode,
} from './types';

/**
 * Check if a theme config is serializable by detecting string-based algorithm
 */
export function isSerializableConfig(
  config: AnyThemeConfig,
): config is SerializableThemeConfig {
  const { algorithm } = config;

  if (algorithm === undefined) return true;

  if (Array.isArray(algorithm))
    return (algorithm as unknown[]).every(alg => typeof alg === 'string');

  return typeof algorithm === 'string';
}

/**
 * Converts a serializable theme config to an Ant Design ThemeConfig
 */
export function deserializeThemeConfig(
  config: SerializableThemeConfig,
): AntdThemeConfig {
  const { algorithm, ...rest } = config;
  const algorithmMap: Record<string, any> = {
    default: antdThemeImport.defaultAlgorithm,
    dark: antdThemeImport.darkAlgorithm,
    compact: antdThemeImport.compactAlgorithm,
  };

  let resolvedAlgorithm;
  if (Array.isArray(algorithm))
    resolvedAlgorithm = algorithm.map((alg: ThemeMode) => algorithmMap[alg]);
  else if (algorithm) resolvedAlgorithm = algorithmMap[algorithm];

  return {
    ...rest,
    algorithm: resolvedAlgorithm,
  };
}

/**
 * Converts an Ant Design ThemeConfig to a serializable format
 */
export function serializeThemeConfig(
  config: AntdThemeConfig,
): SerializableThemeConfig {
  const { algorithm, ...rest } = config;

  let serializedAlgorithm: SerializableThemeConfig['algorithm'];

  if (Array.isArray(algorithm)) {
    serializedAlgorithm = algorithm.map(alg => {
      if (alg === antdThemeImport.defaultAlgorithm) return ThemeMode.DEFAULT;
      if (alg === antdThemeImport.darkAlgorithm) return ThemeMode.DARK;
      if (alg === antdThemeImport.compactAlgorithm) return ThemeMode.COMPACT;
      return ThemeMode.DEFAULT; // Fallback
    }) as ThemeAlgorithmCombination;
  } else if (algorithm) {
    if (algorithm === antdThemeImport.defaultAlgorithm)
      serializedAlgorithm = ThemeMode.DEFAULT;
    else if (algorithm === antdThemeImport.darkAlgorithm)
      serializedAlgorithm = ThemeMode.DARK;
    else if (algorithm === antdThemeImport.compactAlgorithm)
      serializedAlgorithm = ThemeMode.COMPACT;
    else serializedAlgorithm = ThemeMode.DEFAULT; // Fallback
  }

  return {
    ...rest,
    algorithm: serializedAlgorithm,
  };
}

/**
 * Normalize any theme config to a standard AntdThemeConfig
 * This automatically detects and converts serializable configs
 */
export function normalizeThemeConfig(config: AnyThemeConfig): AntdThemeConfig {
  if (isSerializableConfig(config)) return deserializeThemeConfig(config);

  return config as AntdThemeConfig;
}

/**
 * Creates default Ant Design configuration from tokens and dark mode preference
 */
export function getAntdConfig(
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

/**
 * Generate deprecated color variations from a base color
 */
export function genDeprecatedColorVariations(
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

/**
 * Generate deprecated theme colors from system colors
 */
export function getDeprecatedColors(
  systemColors: SystemColors,
  isDark: boolean,
): DeprecatedThemeColors {
  const sc: SystemColors = systemColors;
  return {
    primary: genDeprecatedColorVariations(sc.colorPrimary, isDark),
    error: genDeprecatedColorVariations(sc.colorError, isDark),
    warning: genDeprecatedColorVariations(sc.colorWarning, isDark),
    success: genDeprecatedColorVariations(sc.colorSuccess, isDark),
    info: genDeprecatedColorVariations(sc.colorInfo, isDark),
    grayscale: genDeprecatedColorVariations('#666', isDark),
  };
}

/**
 * Extract system colors from Ant Design tokens
 */
export function getSystemColors(antdTokens: Record<string, any>): SystemColors {
  return {
    colorPrimary: antdTokens.colorPrimary,
    colorError: antdTokens.colorError,
    colorWarning: antdTokens.colorWarning,
    colorSuccess: antdTokens.colorSuccess,
    colorInfo: antdTokens.colorInfo,
  };
}
