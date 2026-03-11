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
import { theme } from 'antd';

/**
 * Superset-specific custom tokens that extend Ant Design's token system.
 * These keys are derived from the SupersetSpecificTokens interface to ensure consistency.
 */
const SUPERSET_CUSTOM_TOKENS: Set<string> = new Set([
  // Font extensions (fontWeightStrong is an Ant Design token, not Superset-specific)
  'fontSizeXS',
  'fontSizeXXL',
  'fontWeightNormal',
  'fontWeightLight',

  // Brand tokens
  'brandIconMaxWidth',
  'brandLogoAlt',
  'brandLogoUrl',
  'brandLogoMargin',
  'brandLogoHref',
  'brandLogoHeight',

  // Spinner tokens
  'brandSpinnerUrl',
  'brandSpinnerSvg',

  // ECharts tokens
  'echartsOptionsOverrides',
  'echartsOptionsOverridesByChartType',

  // Font loading
  'fontUrls',
]);

/**
 * Lazy-loaded cache of valid token names.
 * Combines Ant Design tokens (extracted at runtime) + Superset custom tokens.
 */
let validTokenNamesCache: Set<string> | undefined;

/**
 * Get all valid token names (Ant Design + Superset custom).
 * Uses lazy loading and caching for performance.
 */
function getValidTokenNames(): Set<string> {
  if (validTokenNamesCache === undefined) {
    // Extract all token names from Ant Design's default theme
    const antdTokens = theme.getDesignToken();
    const antdTokenNames = Object.keys(antdTokens);

    // Combine with Superset custom tokens
    validTokenNamesCache = new Set([
      ...antdTokenNames,
      ...SUPERSET_CUSTOM_TOKENS,
    ]);
  }
  return validTokenNamesCache;
}

/**
 * Check if a token name is valid (recognized by Ant Design OR Superset).
 * @param tokenName - The token name to validate
 * @returns true if the token is recognized, false otherwise
 */
export function isValidTokenName(tokenName: string): boolean {
  return getValidTokenNames().has(tokenName);
}

/**
 * Check if a token is a Superset custom token (not from Ant Design).
 * @param tokenName - The token name to check
 * @returns true if it's a Superset-specific token
 */
export function isSupersetCustomToken(tokenName: string): boolean {
  return SUPERSET_CUSTOM_TOKENS.has(tokenName);
}

/**
 * Get all valid token names, categorized by source.
 * Useful for debugging and testing.
 */
export function getAllValidTokenNames(): {
  antdTokens: string[];
  supersetTokens: string[];
  total: number;
} {
  const allTokens = getValidTokenNames();
  const antdTokens = Array.from(allTokens).filter(
    t => !isSupersetCustomToken(t),
  );
  const supersetTokens: string[] = Array.from(SUPERSET_CUSTOM_TOKENS);

  return {
    antdTokens,
    supersetTokens,
    total: allTokens.size,
  };
}
