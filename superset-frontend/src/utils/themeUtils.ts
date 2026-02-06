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
import { logging } from '@apache-superset/core';
import { addInfoToast } from 'src/components/MessageToasts/actions';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import getBootstrapData from 'src/utils/getBootstrapData';
import { store } from 'src/views/store';

/**
 * Check if the current user has admin privileges
 */
const getCurrentUser = () => {
  const bootstrapData = getBootstrapData();
  return bootstrapData?.user;
};

/**
 * Display toast notification for theme token loading failures (admin-only)
 */
export const showThemeTokenFailureToast = (
  tokenName: string,
  themeName: string,
): void => {
  const currentUser = getCurrentUser();

  if (!isUserAdmin(currentUser)) {
    return;
  }

  const message = `Theme token ${tokenName} in ${themeName} was unable to be loaded. Visit the Themes page to fix it.`;

  // Dispatch the toast action directly to the store
  store.dispatch(
    addInfoToast(message, {
      duration: 8000,
      noDuplicate: true,
    }),
  );
};

/**
 * Display a single grouped toast notification for multiple theme token loading failures (admin-only)
 */
export const showGroupedThemeTokenFailureToast = (
  tokenNames: string[],
  themeName: string,
): void => {
  const currentUser = getCurrentUser();

  if (!isUserAdmin(currentUser) || tokenNames.length === 0) {
    return;
  }

  const tokenLabel = tokenNames.length === 1 ? 'token' : 'tokens';
  const tokenList = tokenNames.join(', ');
  const message = `Theme ${tokenLabel} ${tokenList} in ${themeName} was unable to be loaded. Visit the Themes page to fix it.`;

  // Dispatch the toast action directly to the store
  store.dispatch(
    addInfoToast(message, {
      duration: 8000,
      noDuplicate: true,
    }),
  );
};

/**
 * Safely get theme token value with error handling and admin notification
 */
export const getThemeTokenWithErrorHandling = (
  themeConfig: any,
  tokenName: string,
  themeName: string,
  fallbackValue?: any,
): any => {
  try {
    if (!themeConfig?.token) {
      throw new Error(`Theme configuration missing token object`);
    }

    const tokenValue = themeConfig.token[tokenName];

    if (tokenValue === undefined || tokenValue === null) {
      throw new Error(`Token ${tokenName} not found in theme ${themeName}`);
    }

    return tokenValue;
  } catch (error) {
    logging.warn(
      `Failed to load theme token: ${tokenName} from theme: ${themeName}`,
      error,
    );

    showThemeTokenFailureToast(tokenName, themeName);

    return fallbackValue;
  }
};

/**
 * Validate theme configuration and report missing tokens
 */
export const validateThemeTokens = (
  themeConfig: any,
  themeName: string,
  requiredTokens: string[] = [],
): boolean => {
  if (!themeConfig?.token) {
    logging.warn(`Theme ${themeName} missing token configuration`);
    return false;
  }

  const failedTokens: string[] = [];

  requiredTokens.forEach(tokenName => {
    const tokenValue = themeConfig.token[tokenName];

    if (tokenValue === undefined || tokenValue === null) {
      logging.warn(
        `Missing required token: ${tokenName} in theme: ${themeName}`,
      );
      failedTokens.push(tokenName);
    }
  });

  // Show single grouped toast for all failures
  if (failedTokens.length > 0) {
    showGroupedThemeTokenFailureToast(failedTokens, themeName);
  }

  return failedTokens.length === 0;
};

/**
 * Validate theme config structure and common token patterns
 */
export const validateThemeConfiguration = (
  themeName: string,
  themeConfig: any,
): void => {
  if (!themeConfig) {
    logging.warn(`Theme ${themeName} configuration is missing`);
    showThemeTokenFailureToast('configuration', themeName);
    return;
  }

  // Check for common required tokens that should always be present
  const commonRequiredTokens = [
    'colorPrimary',
    'colorBgBase',
    'colorText',
    'fontFamily',
  ];

  validateThemeTokens(themeConfig, themeName, commonRequiredTokens);

  // Check for token structure integrity
  if (themeConfig.token && typeof themeConfig.token !== 'object') {
    logging.warn(`Theme ${themeName} token property is not an object`);
    showThemeTokenFailureToast('token structure', themeName);
  }

  // Validate algorithm if present
  if (themeConfig.algorithm !== undefined) {
    const validAlgorithms = ['default', 'dark', 'compact'];
    const isValidAlgorithm = Array.isArray(themeConfig.algorithm)
      ? themeConfig.algorithm.every(
          (alg: string) =>
            validAlgorithms.includes(alg) || typeof alg === 'function',
        )
      : validAlgorithms.includes(themeConfig.algorithm) ||
        typeof themeConfig.algorithm === 'function';

    if (!isValidAlgorithm) {
      logging.warn(`Theme ${themeName} has invalid algorithm configuration`);
      showThemeTokenFailureToast('algorithm', themeName);
    }
  }
};
