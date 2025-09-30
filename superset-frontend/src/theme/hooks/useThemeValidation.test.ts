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
import { renderHook } from '@testing-library/react-hooks';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import {
  useThemeValidation,
  useIsEnhancedValidationEnabled,
} from './useThemeValidation';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;

describe('useThemeValidation', () => {
  beforeEach(() => {
    mockIsFeatureEnabled.mockClear();
  });

  test('returns basic JSON validation when feature flag is disabled', () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    // Test with valid JSON to ensure feature flag controls enhanced validation
    const validJson = '{"token": {"colorPrimary": "#1890ff"}}';
    const { result } = renderHook(() => useThemeValidation(validJson));

    expect(result.current.hasErrors).toBe(false);
    expect(result.current.hasWarnings).toBe(false);
    expect(result.current.validTokenCount).toBe(0); // No enhanced validation
    expect(result.current.invalidTokenCount).toBe(0); // No enhanced validation
  });

  test('returns enhanced validation when feature flag is enabled with valid JSON', () => {
    mockIsFeatureEnabled.mockReturnValue(true);

    const validTheme = JSON.stringify({
      token: {
        colorPrimary: '#1890ff',
        fontSize: 14,
      },
    });

    const { result } = renderHook(() =>
      useThemeValidation(validTheme, { themeName: 'Test Theme' }),
    );

    expect(result.current.hasErrors).toBe(false);
    expect(result.current.validTokenCount).toBe(2);
    expect(result.current.invalidTokenCount).toBe(0);
  });

  test('returns enhanced validation warnings for invalid tokens when feature flag is enabled', () => {
    mockIsFeatureEnabled.mockReturnValue(true);

    const invalidTheme = JSON.stringify({
      token: {
        colorPrimary: '#1890ff', // valid
        fontSize: 'invalid-size', // invalid
        unknownToken: 'value', // unknown
      },
    });

    const { result } = renderHook(() =>
      useThemeValidation(invalidTheme, { themeName: 'Test Theme' }),
    );

    expect(result.current.hasWarnings).toBe(true);
    expect(result.current.validTokenCount).toBe(1);
    expect(result.current.invalidTokenCount).toBe(2);
    expect(result.current.annotations.length).toBeGreaterThan(0);
  });

  test('skips enhanced validation for empty JSON', () => {
    mockIsFeatureEnabled.mockReturnValue(true);

    const { result } = renderHook(() => useThemeValidation(''));

    expect(result.current.hasErrors).toBe(false);
    expect(result.current.hasWarnings).toBe(false);
    expect(result.current.validTokenCount).toBe(0);
    expect(result.current.invalidTokenCount).toBe(0);
  });

  test('can be disabled via options', () => {
    mockIsFeatureEnabled.mockReturnValue(true);

    const { result } = renderHook(() =>
      useThemeValidation('{"token": {"colorPrimary": "#fff"}}', {
        enabled: false,
      }),
    );

    expect(result.current.hasErrors).toBe(false);
    expect(result.current.hasWarnings).toBe(false);
    expect(result.current.validTokenCount).toBe(0);
  });
});

describe('useIsEnhancedValidationEnabled', () => {
  test('returns feature flag status', () => {
    mockIsFeatureEnabled.mockReturnValue(true);

    const { result } = renderHook(() => useIsEnhancedValidationEnabled());

    expect(result.current).toBe(true);
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith(
      FeatureFlag.EnhancedThemeValidation,
    );
  });

  test('returns false when feature flag is disabled', () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const { result } = renderHook(() => useIsEnhancedValidationEnabled());

    expect(result.current).toBe(false);
  });
});
