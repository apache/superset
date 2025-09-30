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

import type { AnyThemeConfig } from '@superset-ui/core/theme/types';
import {
  validateThemeTokens,
  getPartialThemeConfig,
  formatValidationErrors,
  TokenCategory,
  ErrorType,
} from './themeTokenValidation';

// validateThemeTokens tests
test('validates a valid theme configuration', () => {
  const validTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#1890ff',
      fontSize: 14,
      borderRadius: '6px',
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      wireframe: false,
    },
  };

  const result = validateThemeTokens(validTheme);

  expect(result.isValid).toBe(true);
  expect(result.errors).toHaveLength(0);
  expect(Object.keys(result.validTokens)).toHaveLength(6);
  expect(Object.keys(result.invalidTokens)).toHaveLength(0);
});

test('detects invalid color tokens', () => {
  const invalidTheme: AnyThemeConfig = {
    token: {
      colorPrimary: 'invalid-color',
      colorSuccess: '#gggggg',
      colorError: 'rgb(300, 300, 300)',
    },
  };

  const result = validateThemeTokens(invalidTheme);

  expect(result.isValid).toBe(false);
  expect(result.errors).toHaveLength(3);
  expect(
    result.errors.every(error => error.errorType === ErrorType.InvalidColor),
  ).toBe(true);
  expect(Object.keys(result.invalidTokens)).toHaveLength(3);
});

test('detects invalid size tokens', () => {
  const invalidTheme: AnyThemeConfig = {
    token: {
      fontSize: 'invalid-size',
      borderRadius: 'not-a-size',
      padding: -10,
    },
  };

  const result = validateThemeTokens(invalidTheme);

  expect(result.isValid).toBe(false);
  expect(result.errors).toHaveLength(3);
  expect(
    result.errors.every(error => error.errorType === ErrorType.InvalidSize),
  ).toBe(true);
});

test('detects unknown tokens', () => {
  const invalidTheme: AnyThemeConfig = {
    token: {
      unknownToken: 'value',
      anotherUnknownToken: 'another-value',
    },
  };

  const result = validateThemeTokens(invalidTheme);

  expect(result.isValid).toBe(false);
  expect(result.errors).toHaveLength(2);
  expect(
    result.errors.every(error => error.errorType === ErrorType.UnknownToken),
  ).toBe(true);
});

test('validates mixed valid and invalid tokens', () => {
  const mixedTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#1890ff',
      fontSize: 14,
      colorError: 'not-a-color',
      unknownToken: 'value',
      borderRadius: '6px',
    },
  };

  const result = validateThemeTokens(mixedTheme);

  expect(result.isValid).toBe(false);
  expect(result.errors).toHaveLength(2);
  expect(Object.keys(result.validTokens)).toHaveLength(3);
  expect(Object.keys(result.invalidTokens)).toHaveLength(2);
});

test('handles empty theme configuration', () => {
  const emptyTheme: AnyThemeConfig = {};

  const result = validateThemeTokens(emptyTheme);

  expect(result.isValid).toBe(true);
  expect(result.errors).toHaveLength(0);
  expect(Object.keys(result.validTokens)).toHaveLength(0);
});

test('validates font tokens correctly', () => {
  const fontTheme: AnyThemeConfig = {
    token: {
      fontFamily: 'Arial, sans-serif',
      fontWeightStrong: 600,
      fontWeightNormal: 'normal',
      fontWeightLight: 'invalid-weight',
    },
  };

  const result = validateThemeTokens(fontTheme);

  expect(result.isValid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].tokenName).toBe('fontWeightLight');
  expect(Object.keys(result.validTokens)).toHaveLength(3);
});

test('validates shadow tokens correctly', () => {
  const shadowTheme: AnyThemeConfig = {
    token: {
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      boxShadowSecondary: 'none',
      boxShadowTertiary: 'invalid-shadow',
    },
  };

  const result = validateThemeTokens(shadowTheme);

  expect(result.isValid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].tokenName).toBe('boxShadowTertiary');
  expect(Object.keys(result.validTokens)).toHaveLength(2);
});

test('validates motion tokens correctly', () => {
  const motionTheme: AnyThemeConfig = {
    token: {
      motionDurationFast: '0.1s',
      motionDurationMid: '200ms',
      motionEaseInOut: 'ease-in-out',
      motionEaseInBack: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      motionDurationSlow: 'invalid-duration',
    },
  };

  const result = validateThemeTokens(motionTheme);

  expect(result.isValid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].tokenName).toBe('motionDurationSlow');
  expect(Object.keys(result.validTokens)).toHaveLength(4);
});

test('validates boolean tokens correctly', () => {
  const booleanTheme: AnyThemeConfig = {
    token: {
      wireframe: true,
    },
  };

  const result = validateThemeTokens(booleanTheme);

  expect(result.isValid).toBe(true);
  expect(result.errors).toHaveLength(0);
  expect(Object.keys(result.validTokens)).toHaveLength(1);
});

// getPartialThemeConfig tests
test('returns theme config with only valid tokens', () => {
  const mixedTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#1890ff',
      fontSize: 14,
      colorError: 'not-a-color',
      unknownToken: 'value',
      borderRadius: '6px',
    },
    components: {
      Button: {
        colorPrimary: '#ff0000',
      },
    },
  };

  const result = getPartialThemeConfig(mixedTheme);
  expect(result.components).toEqual({
    Button: {
      colorPrimary: '#ff0000',
    },
  });
  expect(Object.keys(result.token || {})).toHaveLength(3);
  expect(result.token).toEqual({
    colorPrimary: '#1890ff',
    fontSize: 14,
    borderRadius: '6px',
  });
});

// formatValidationErrors tests
test('formats validation errors with theme name', () => {
  const errors = [
    {
      tokenName: 'colorPrimary',
      tokenValue: 'invalid-color',
      category: TokenCategory.COLOR,
      errorType: ErrorType.InvalidColor,
      message:
        "Token 'colorPrimary' has invalid value 'invalid-color' for category 'color'",
    },
  ];

  const result = formatValidationErrors(errors, 'My Theme');

  expect(result).toHaveLength(1);
  expect(result[0]).toBe(
    "Theme \"My Theme\": Token 'colorPrimary' was unable to be loaded - Token 'colorPrimary' has invalid value 'invalid-color' for category 'color'",
  );
});

test('formats validation errors without theme name', () => {
  const errors = [
    {
      tokenName: 'fontSize',
      tokenValue: 'invalid-size',
      category: TokenCategory.SIZE,
      errorType: ErrorType.InvalidSize,
      message:
        "Token 'fontSize' has invalid value 'invalid-size' for category 'size'",
    },
  ];

  const result = formatValidationErrors(errors);

  expect(result).toHaveLength(1);
  expect(result[0]).toBe(
    "Token 'fontSize' was unable to be loaded - Token 'fontSize' has invalid value 'invalid-size' for category 'size'",
  );
});

// color validation edge cases tests
test('validates various color formats', () => {
  const colorTheme: AnyThemeConfig = {
    token: {
      colorPrimary: '#ff0000',
      colorSuccess: '#f00',
      colorError: '#ff000080',
      colorWarning: 'rgb(255, 0, 0)',
      colorInfo: 'rgba(255, 0, 0, 0.5)',
      colorBgBase: 'hsl(0, 100%, 50%)',
      colorText: 'hsla(0, 100%, 50%, 0.5)',
      colorBorder: 'transparent',
      colorFill: 'inherit',
      colorIcon: 'red',
    },
  };

  const result = validateThemeTokens(colorTheme);

  expect(result.isValid).toBe(true);
  expect(Object.keys(result.validTokens)).toHaveLength(10);
});

// size validation edge cases tests
test('validates various size formats', () => {
  const sizeTheme: AnyThemeConfig = {
    token: {
      fontSize: 16,
      borderRadius: '16px',
      padding: '1em',
      margin: '1.5rem',
      controlHeight: '50%',
      screenLG: '100vh',
      lineHeight: 'auto',
      paddingLG: 'inherit',
      marginSM: '0',
    },
  };

  const result = validateThemeTokens(sizeTheme);

  expect(result.isValid).toBe(true);
  expect(Object.keys(result.validTokens)).toHaveLength(9);
});
