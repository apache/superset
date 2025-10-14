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
import { validateTheme } from './themeStructureValidation';

test('validateTheme validates a valid theme with standard tokens', () => {
  const theme: AnyThemeConfig = {
    token: {
      colorPrimary: '#1890ff',
      fontSize: 14,
    },
  };

  const result = validateTheme(theme);

  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
  expect(result.warnings).toHaveLength(0);
});

test('validateTheme validates a theme with Superset custom tokens', () => {
  const theme: AnyThemeConfig = {
    token: {
      colorPrimary: '#1890ff',
      brandLogoUrl: '/static/logo.png',
      brandSpinnerSvg: '<svg></svg>',
    },
  };

  const result = validateTheme(theme);

  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
  expect(result.warnings).toHaveLength(0);
});

test('validateTheme warns about unknown token names', () => {
  const theme: AnyThemeConfig = {
    token: {
      colorPrimary: '#1890ff',
      fooBarBaz: 'invalid',
      colrPrimary: '#ff0000', // Typo
    },
  };

  const result = validateTheme(theme);

  expect(result.valid).toBe(true); // Warnings don't block
  expect(result.errors).toHaveLength(0);
  expect(result.warnings).toHaveLength(2);
  expect(result.warnings[0].tokenName).toBe('fooBarBaz');
  expect(result.warnings[1].tokenName).toBe('colrPrimary');
  expect(result.warnings[0].severity).toBe('warning');
});

test('validateTheme warns about null/undefined token values', () => {
  const theme: AnyThemeConfig = {
    token: {
      colorPrimary: null,
      fontSize: undefined,
    },
  };

  const result = validateTheme(theme);

  expect(result.valid).toBe(true);
  expect(result.warnings).toHaveLength(2);
  expect(result.warnings[0].message).toContain('null/undefined');
  expect(result.warnings[1].message).toContain('null/undefined');
});

test('validateTheme errors on empty theme object', () => {
  const theme: AnyThemeConfig = {};

  const result = validateTheme(theme);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].tokenName).toBe('_root');
  expect(result.errors[0].message).toContain('cannot be empty');
});

test('validateTheme errors on null theme config', () => {
  const result = validateTheme(null as any);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].message).toContain('must be a valid object');
});

test('validateTheme allows theme with only algorithm', () => {
  const theme: AnyThemeConfig = {
    algorithm: 'dark' as any,
  };

  const result = validateTheme(theme);

  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

test('validateTheme allows theme with only components', () => {
  const theme: AnyThemeConfig = {
    components: {
      Button: {
        colorPrimary: '#1890ff',
      },
    },
  };

  const result = validateTheme(theme);

  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

test('validateTheme errors on theme with empty token object but no algorithm or components', () => {
  const theme: AnyThemeConfig = {
    token: {},
  };

  const result = validateTheme(theme);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].message).toContain('cannot be empty');
});

test('validateTheme combines errors and warnings correctly', () => {
  const theme: AnyThemeConfig = {
    token: {
      colorPrimary: '#1890ff',
      unknownToken: 'value',
      nullToken: null,
    },
  };

  const result = validateTheme(theme);

  expect(result.valid).toBe(true); // No errors, just warnings
  expect(result.errors).toHaveLength(0);
  expect(result.warnings.length).toBeGreaterThan(0);
});
