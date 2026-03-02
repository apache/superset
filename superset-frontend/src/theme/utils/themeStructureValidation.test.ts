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
import type { AnyThemeConfig } from '@apache-superset/core/ui';
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

test('validateTheme errors when token is an array instead of object', () => {
  const theme = {
    token: ['colorPrimary', '#1890ff'],
  } as unknown as AnyThemeConfig;

  const result = validateTheme(theme);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].tokenName).toBe('_root');
  expect(result.errors[0].message).toContain('must be an object');
});

test('validateTheme errors when token is a string instead of object', () => {
  const theme = {
    token: 'colorPrimary',
  } as unknown as AnyThemeConfig;

  const result = validateTheme(theme);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].message).toContain('must be an object');
});

test('validateTheme errors when components is an array instead of object', () => {
  const theme = {
    token: { colorPrimary: '#1890ff' },
    components: ['Button', 'Input'],
  } as unknown as AnyThemeConfig;

  const result = validateTheme(theme);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].tokenName).toBe('_root');
  expect(result.errors[0].message).toContain('Components configuration');
  expect(result.errors[0].message).toContain('must be an object');
});

test('validateTheme errors when components is a primitive', () => {
  const theme = {
    token: { colorPrimary: '#1890ff' },
    components: 'Button',
  } as unknown as AnyThemeConfig;

  const result = validateTheme(theme);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].message).toContain('Components configuration');
});

test('validateTheme errors when algorithm is a number', () => {
  const theme = {
    token: { colorPrimary: '#1890ff' },
    algorithm: 123,
  } as unknown as AnyThemeConfig;

  const result = validateTheme(theme);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].tokenName).toBe('_root');
  expect(result.errors[0].message).toContain('Algorithm must be a string');
});

test('validateTheme errors when algorithm is an object', () => {
  const theme = {
    token: { colorPrimary: '#1890ff' },
    algorithm: { type: 'dark' },
  } as unknown as AnyThemeConfig;

  const result = validateTheme(theme);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].message).toContain('Algorithm must be a string');
});

test('validateTheme allows algorithm as array of strings', () => {
  const theme = {
    algorithm: ['dark', 'compact'],
  } as unknown as AnyThemeConfig;

  const result = validateTheme(theme);

  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
});

test('validateTheme errors when algorithm array contains non-strings', () => {
  const theme = {
    token: { colorPrimary: '#1890ff' },
    algorithm: ['dark', 123, 'compact'],
  } as unknown as AnyThemeConfig;

  const result = validateTheme(theme);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].message).toContain('Algorithm must be a string');
});

test('validateTheme errors when token is explicitly null', () => {
  const theme = {
    token: null,
    algorithm: 'dark',
  } as unknown as AnyThemeConfig;

  const result = validateTheme(theme);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].tokenName).toBe('_root');
  expect(result.errors[0].message).toContain('must be an object');
  expect(result.errors[0].message).toContain('not null');
});

test('validateTheme errors when components is explicitly null', () => {
  const theme = {
    token: { colorPrimary: '#1890ff' },
    components: null,
  } as unknown as AnyThemeConfig;

  const result = validateTheme(theme);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].tokenName).toBe('_root');
  expect(result.errors[0].message).toContain('Components configuration');
  expect(result.errors[0].message).toContain('not null');
});

test('validateTheme errors when algorithm is explicitly null', () => {
  const theme = {
    token: { colorPrimary: '#1890ff' },
    algorithm: null,
  } as unknown as AnyThemeConfig;

  const result = validateTheme(theme);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].tokenName).toBe('_root');
  expect(result.errors[0].message).toContain('Algorithm cannot be null');
});

test('validateTheme errors when algorithm string is not a valid value', () => {
  const theme = {
    algorithm: 'invalid-algorithm',
  } as unknown as AnyThemeConfig;

  const result = validateTheme(theme);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].tokenName).toBe('_root');
  expect(result.errors[0].message).toContain('Invalid algorithm value');
  expect(result.errors[0].message).toContain('invalid-algorithm');
  expect(result.errors[0].message).toContain('default, dark, system, compact');
});

test('validateTheme errors when algorithm array contains invalid values', () => {
  const theme = {
    algorithm: ['dark', 'invalid-mode', 'compact'],
  } as unknown as AnyThemeConfig;

  const result = validateTheme(theme);

  expect(result.valid).toBe(false);
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].message).toContain('Invalid algorithm value');
  expect(result.errors[0].message).toContain('invalid-mode');
});

test('validateTheme allows all valid algorithm values', () => {
  const validAlgorithms = ['default', 'dark', 'system', 'compact'];

  validAlgorithms.forEach(algo => {
    const theme = { algorithm: algo } as unknown as AnyThemeConfig;
    const result = validateTheme(theme);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
