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
import {
  type AntdThemeConfig,
  type AnyThemeConfig,
  type SerializableThemeConfig,
  type SystemColors,
  type SupersetTheme,
  ThemeAlgorithm,
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
  if (Array.isArray(algorithm)) {
    const validAlgorithms = algorithm
      .map((alg: ThemeAlgorithm) => algorithmMap[alg])
      .filter(Boolean);

    // If we have valid algorithms, use them; otherwise fallback to default
    if (validAlgorithms.length > 0) {
      resolvedAlgorithm =
        validAlgorithms.length === 1 ? validAlgorithms[0] : validAlgorithms;
    } else {
      resolvedAlgorithm = antdThemeImport.defaultAlgorithm;
    }
  } else if (algorithm && algorithmMap[algorithm]) {
    resolvedAlgorithm = algorithmMap[algorithm];
  } else {
    resolvedAlgorithm = antdThemeImport.defaultAlgorithm;
  }

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
      if (alg === antdThemeImport.defaultAlgorithm)
        return ThemeAlgorithm.DEFAULT;
      if (alg === antdThemeImport.darkAlgorithm) return ThemeAlgorithm.DARK;
      if (alg === antdThemeImport.compactAlgorithm)
        return ThemeAlgorithm.COMPACT;
      return ThemeAlgorithm.DEFAULT; // Fallback
    }) as ThemeAlgorithm[];
  } else if (algorithm) {
    if (algorithm === antdThemeImport.defaultAlgorithm)
      serializedAlgorithm = ThemeAlgorithm.DEFAULT;
    else if (algorithm === antdThemeImport.darkAlgorithm)
      serializedAlgorithm = ThemeAlgorithm.DARK;
    else if (algorithm === antdThemeImport.compactAlgorithm)
      serializedAlgorithm = ThemeAlgorithm.COMPACT;
    else serializedAlgorithm = ThemeAlgorithm.DEFAULT; // Fallback
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
