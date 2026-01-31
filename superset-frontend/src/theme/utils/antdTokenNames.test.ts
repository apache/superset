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
import {
  isValidTokenName,
  isSupersetCustomToken,
  getAllValidTokenNames,
} from './antdTokenNames';

test('isValidTokenName recognizes standard Ant Design tokens', () => {
  expect(isValidTokenName('colorPrimary')).toBe(true);
  expect(isValidTokenName('fontSize')).toBe(true);
  expect(isValidTokenName('padding')).toBe(true);
  expect(isValidTokenName('borderRadius')).toBe(true);
});

test('isValidTokenName recognizes Superset custom tokens', () => {
  expect(isValidTokenName('brandLogoUrl')).toBe(true);
  expect(isValidTokenName('brandSpinnerSvg')).toBe(true);
  expect(isValidTokenName('fontSizeXS')).toBe(true);
  expect(isValidTokenName('echartsOptionsOverrides')).toBe(true);
});

test('isValidTokenName rejects unknown tokens', () => {
  expect(isValidTokenName('fooBarBaz')).toBe(false);
  expect(isValidTokenName('colrPrimary')).toBe(false);
  expect(isValidTokenName('invalidToken')).toBe(false);
});

test('isValidTokenName handles edge cases', () => {
  expect(isValidTokenName('')).toBe(false);
  expect(isValidTokenName('  ')).toBe(false);
});

test('isSupersetCustomToken identifies Superset-specific tokens', () => {
  expect(isSupersetCustomToken('brandLogoUrl')).toBe(true);
  expect(isSupersetCustomToken('brandSpinnerSvg')).toBe(true);
  expect(isSupersetCustomToken('fontSizeXS')).toBe(true);
  expect(isSupersetCustomToken('fontUrls')).toBe(true);
});

test('isSupersetCustomToken returns false for Ant Design tokens', () => {
  expect(isSupersetCustomToken('colorPrimary')).toBe(false);
  expect(isSupersetCustomToken('fontSize')).toBe(false);
});

test('isSupersetCustomToken returns false for unknown tokens', () => {
  expect(isSupersetCustomToken('fooBar')).toBe(false);
});

test('getAllValidTokenNames returns categorized token names', () => {
  const result = getAllValidTokenNames();

  expect(result).toHaveProperty('antdTokens');
  expect(result).toHaveProperty('supersetTokens');
  expect(result).toHaveProperty('total');
});

test('getAllValidTokenNames has reasonable token counts', () => {
  const result = getAllValidTokenNames();

  // Ant Design tokens should exist (avoid brittle exact count that breaks on upgrades)
  expect(result.antdTokens.length).toBeGreaterThan(0);
  expect(result.antdTokens).toContain('colorPrimary');
  expect(result.antdTokens).toContain('fontSize');
  expect(result.antdTokens).toContain('borderRadius');

  // Superset custom tokens should exist
  expect(result.supersetTokens.length).toBeGreaterThan(0);
  expect(result.supersetTokens).toContain('brandLogoUrl');
  expect(result.supersetTokens).toContain('fontUrls');

  // Total should be sum of both
  expect(result.total).toBe(
    result.antdTokens.length + result.supersetTokens.length,
  );
});

test('getAllValidTokenNames includes known Superset tokens', () => {
  const result = getAllValidTokenNames();

  expect(result.supersetTokens).toContain('brandLogoUrl');
  expect(result.supersetTokens).toContain('brandSpinnerSvg');
  expect(result.supersetTokens).toContain('fontSizeXS');
});

test('getAllValidTokenNames includes known Ant Design tokens', () => {
  const result = getAllValidTokenNames();

  expect(result.antdTokens).toContain('colorPrimary');
  expect(result.antdTokens).toContain('fontSize');
  expect(result.antdTokens).toContain('padding');
});
