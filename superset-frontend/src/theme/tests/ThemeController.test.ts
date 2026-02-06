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
import {} from '@superset-ui/core';
import {
  type AnyThemeConfig,
  type SupersetThemeConfig,
  Theme,
  ThemeAlgorithm,
  ThemeMode,
} from '@apache-superset/core/ui';
import type {
  BootstrapThemeDataConfig,
  CommonBootstrapData,
} from 'src/types/bootstrapTypes';
import getBootstrapData from 'src/utils/getBootstrapData';
import { LocalStorageAdapter, ThemeController } from '../ThemeController';

jest.mock('../../utils/getBootstrapData');
const mockGetBootstrapData = getBootstrapData as jest.MockedFunction<
  typeof getBootstrapData
>;

const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

const mockMatchMedia = jest.fn();
const mockThemeFromConfig = jest.fn();
const mockSetConfig = jest.fn();

// Mock data constants
const DEFAULT_THEME: AnyThemeConfig = {
  token: {
    colorBgBase: '#ededed',
    colorTextBase: '#120f0f',
    colorLink: '#0062ec',
    colorPrimary: '#c96f0f',
    colorInfo: '#c96f0f',
    colorSuccess: '#3c7c1b',
    colorWarning: '#dc9811',
  },
};

const DARK_THEME: AnyThemeConfig = {
  token: {
    colorBgBase: '#141118',
    colorTextBase: '#fdc7c7',
    colorLink: '#0062ec',
    colorPrimary: '#c96f0f',
    colorInfo: '#c96f0f',
    colorSuccess: '#3c7c1b',
    colorWarning: '#dc9811',
  },
  algorithm: ThemeAlgorithm.DARK,
};

// BootstrapData common template generator
const createMockBootstrapData = (
  themeConfig: BootstrapThemeDataConfig = {
    default: DEFAULT_THEME,
    dark: DARK_THEME,
  },
): { common: CommonBootstrapData } => ({
  common: {
    application_root: '/',
    static_assets_prefix: '/static/assets/',
    conf: {},
    locale: 'en',
    feature_flags: {},
    language_pack: {},
    extra_categorical_color_schemes: [],
    extra_sequential_color_schemes: [],
    theme: themeConfig,
    menu_data: {},
    d3_format: {},
    d3_time_format: {},
  } as any as CommonBootstrapData,
});

const mockThemeObject = {
  setConfig: mockSetConfig,
  theme: DEFAULT_THEME,
} as unknown as Theme;

// Helper to create a fresh ThemeController with common setup
const createController = (
  options: Partial<ConstructorParameters<typeof ThemeController>[0]> = {},
) =>
  new ThemeController({
    themeObject: mockThemeObject,
    ...options,
  });

// Shared console spies
const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

beforeEach(() => {
  jest.clearAllMocks();

  // Setup DOM environment
  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });

  Object.defineProperty(window, 'matchMedia', {
    value: mockMatchMedia,
    writable: true,
  });

  mockMatchMedia.mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });

  mockSetConfig.mockImplementation(() => {});
  mockThemeFromConfig.mockReturnValue(mockThemeObject);

  // Mock Theme constructor
  (Theme as any).fromConfig = mockThemeFromConfig;

  // Reset localStorage mocks
  mockLocalStorage.getItem.mockReturnValue(null);
  mockLocalStorage.setItem.mockImplementation(() => {});
  mockLocalStorage.removeItem.mockImplementation(() => {});

  // Default BootstrapData
  mockGetBootstrapData.mockReturnValue(createMockBootstrapData());
});

afterAll(() => {
  consoleSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

// LocalStorageAdapter tests
test('LocalStorageAdapter returns item from localStorage', () => {
  const adapter = new LocalStorageAdapter();
  mockLocalStorage.getItem.mockReturnValue('test-value');

  const result = adapter.getItem('test-key');

  expect(mockLocalStorage.getItem).toHaveBeenCalledTimes(1);
  expect(mockLocalStorage.getItem).toHaveBeenCalledWith('test-key');
  expect(result).toBe('test-value');
});

test('LocalStorageAdapter sets item in localStorage', () => {
  const adapter = new LocalStorageAdapter();

  adapter.setItem('test-key', 'test-value');

  expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
  expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
    'test-key',
    'test-value',
  );
});

test('LocalStorageAdapter handles localStorage errors while setting an item', () => {
  const adapter = new LocalStorageAdapter();
  mockLocalStorage.setItem.mockImplementation(() => {
    throw new Error('Storage error');
  });

  adapter.setItem('test-key', 'test-value');

  expect(consoleSpy).toHaveBeenCalledTimes(1);
  expect(consoleSpy).toHaveBeenCalledWith(
    'Failed to write to localStorage:',
    expect.any(Error),
  );
});

test('LocalStorageAdapter removes item from localStorage', () => {
  const adapter = new LocalStorageAdapter();

  adapter.removeItem('test-key');

  expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(1);
  expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test-key');
});

test('LocalStorageAdapter handles localStorage errors while removing an item', () => {
  const adapter = new LocalStorageAdapter();
  mockLocalStorage.removeItem.mockImplementation(() => {
    throw new Error('Storage error');
  });

  adapter.removeItem('test-key');

  expect(consoleSpy).toHaveBeenCalledTimes(1);
  expect(consoleSpy).toHaveBeenCalledWith(
    'Failed to remove from localStorage:',
    expect.any(Error),
  );
});

// ThemeController initialization tests
test('ThemeController initializes with default options', () => {
  const controller = createController();

  expect(controller.getTheme()).toBe(mockThemeObject);
});

test('ThemeController uses BootstrapData themes when available', () => {
  createController();

  expect(mockSetConfig).toHaveBeenCalledTimes(1);
  expect(mockSetConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      token: expect.objectContaining({
        colorBgBase: '#ededed',
        colorPrimary: '#c96f0f',
      }),
    }),
  );
});

test('ThemeController fallbacks to Superset default theme when BootstrapData themes are empty', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: {},
      dark: {},
    }),
  );

  const fallbackTheme = {
    token: {
      colorBgBase: '#ffffff',
      colorPrimary: '#1890ff',
    },
  };

  createController({ defaultTheme: fallbackTheme });

  expect(mockSetConfig).toHaveBeenCalledTimes(1);
  expect(mockSetConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      ...fallbackTheme,
      algorithm: antdThemeImport.defaultAlgorithm,
    }),
  );
});

test('ThemeController handles system theme preference', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: DEFAULT_THEME,
      dark: DARK_THEME,
    }),
  );

  const controller = createController();

  expect(controller.getCurrentMode()).toBe(ThemeMode.SYSTEM);
});

test('ThemeController handles only default theme', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: DEFAULT_THEME,
      dark: {},
    }),
  );

  const controller = createController();

  jest.clearAllMocks();

  expect(() => controller.setThemeMode(ThemeMode.DARK)).toThrow(
    'Theme mode changes are not allowed when only one theme is available',
  );

  expect(mockSetConfig).not.toHaveBeenCalled();
});

test('ThemeController handles only dark theme', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: {},
      dark: DARK_THEME,
    }),
  );

  const lightThemeFallback = {
    token: {
      colorBgBase: '#fff',
      colorTextBase: '#000',
      colorPrimary: '#1890ff',
    },
  };

  const controller = createController({ defaultTheme: lightThemeFallback });

  expect(mockSetConfig).toHaveBeenCalledTimes(1);

  const calledWith = mockSetConfig.mock.calls[0][0];

  expect(calledWith.token.colorBgBase).toBe('#fff');
  expect(calledWith.token.colorTextBase).toBe('#000');

  expect(controller.canSetMode()).toBe(true);

  jest.clearAllMocks();
  controller.setThemeMode(ThemeMode.DARK);
  expect(mockSetConfig).toHaveBeenCalledTimes(1);
});

test('ThemeController handles completely empty BootstrapData', () => {
  const fallbackTheme = {
    token: {
      colorBgBase: '#ffffff',
      colorPrimary: '#1890ff',
    },
  };

  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: {},
      dark: {},
    }),
  );

  createController({ defaultTheme: fallbackTheme });

  expect(mockSetConfig).toHaveBeenCalledTimes(1);
  expect(mockSetConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      token: expect.objectContaining({
        colorBgBase: '#ffffff',
        colorPrimary: '#1890ff',
      }),
      algorithm: antdThemeImport.defaultAlgorithm,
    }),
  );
});

test('ThemeController handles missing theme object', () => {
  const fallbackTheme = { token: { colorPrimary: '#fallback' } };

  mockGetBootstrapData.mockReturnValue({
    common: {
      application_root: '/',
      static_assets_prefix: '/static/assets/',
      conf: {},
      locale: 'en',
      feature_flags: {},
      language_pack: {},
      extra_categorical_color_schemes: [],
      extra_sequential_color_schemes: [],
      menu_data: {},
      d3_format: {},
      d3_time_format: {},
    } as any,
  });

  createController({ defaultTheme: fallbackTheme });

  expect(mockSetConfig).toHaveBeenCalledTimes(1);
  expect(mockSetConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      token: expect.objectContaining({
        colorPrimary: '#fallback',
      }),
      algorithm: antdThemeImport.defaultAlgorithm,
    }),
  );
});

// Theme Management tests

test('ThemeController updates theme when allowed', () => {
  const controller = createController();

  const newTheme = {
    token: {
      colorBgBase: '#000000',
      colorPrimary: '#ff0000',
    },
  };

  controller.setTheme(newTheme);

  expect(mockSetConfig).toHaveBeenCalledWith(expect.objectContaining(newTheme));
});

test('ThemeController changes theme mode when allowed', () => {
  const controller = createController();

  jest.clearAllMocks();

  controller.setThemeMode(ThemeMode.DARK);

  expect(controller.getCurrentMode()).toBe(ThemeMode.DARK);
  expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
  expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
    'superset-theme-mode',
    ThemeMode.DARK,
  );
});

test('ThemeController handles missing theme gracefully', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: DEFAULT_THEME,
      dark: {},
    }),
  );

  const controller = createController();

  expect(() => controller.setThemeMode(ThemeMode.DARK)).toThrow(
    'Theme mode changes are not allowed when only one theme is available',
  );

  expect(controller.getCurrentMode()).toBe(ThemeMode.DEFAULT);
  expect(consoleSpy).not.toHaveBeenCalled();
});

test('ThemeController does not change mode if already set', () => {
  const controller = createController();

  jest.clearAllMocks();

  controller.setThemeMode(ThemeMode.SYSTEM);

  expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
});

test('ThemeController resets to default theme', () => {
  const controller = createController();

  controller.setThemeMode(ThemeMode.DARK);
  controller.resetTheme();

  expect(controller.getCurrentMode()).toBe(ThemeMode.DEFAULT);
  expect(mockSetConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      token: expect.objectContaining({
        colorBgBase: '#ededed',
        colorTextBase: '#120f0f',
      }),
    }),
  );
});

// System Theme Changes tests
test('ThemeController listens to system theme changes', () => {
  const mockMediaQuery = {
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  mockMatchMedia.mockReturnValue(mockMediaQuery);

  createController();

  expect(mockMediaQuery.addEventListener).toHaveBeenCalledTimes(1);
  expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith(
    'change',
    expect.any(Function),
  );
});

test('ThemeController updates theme when system preference changes and mode is SYSTEM', () => {
  const mockMediaQuery = {
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  mockMatchMedia.mockReturnValue(mockMediaQuery);

  const controller = createController();
  controller.setThemeMode(ThemeMode.SYSTEM);

  mockMediaQuery.matches = true;
  const changeHandler = mockMediaQuery.addEventListener.mock.calls[0][1];

  changeHandler();

  expect(mockSetConfig).toHaveBeenCalled();
});

test('ThemeController does not update theme when mode is not SYSTEM', () => {
  const mockMediaQuery = {
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  mockMatchMedia.mockReturnValue(mockMediaQuery);

  const controller = createController();
  controller.setThemeMode(ThemeMode.DEFAULT);

  const initialCallCount = mockSetConfig.mock.calls.length;

  mockMediaQuery.matches = true;
  const changeHandler = mockMediaQuery.addEventListener.mock.calls[0][1];

  changeHandler();

  expect(mockSetConfig).toHaveBeenCalledTimes(initialCallCount);
});

test('ThemeController switches to dark theme when system is dark and mode is SYSTEM', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: DEFAULT_THEME,
      dark: DARK_THEME,
    }),
  );

  const mockMediaQueryDark = {
    matches: true,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  mockMatchMedia.mockReturnValue(mockMediaQueryDark);

  const controller = createController();

  expect(controller.getCurrentMode()).toBe(ThemeMode.SYSTEM);

  expect(mockSetConfig).toHaveBeenCalled();
  const lastCall =
    mockSetConfig.mock.calls[mockSetConfig.mock.calls.length - 1][0];
  expect(lastCall.token.colorBgBase).toBe(DARK_THEME.token!.colorBgBase);
  expect(lastCall.token.colorTextBase).toBe(DARK_THEME.token!.colorTextBase);
});

// Persistence tests

test('ThemeController saves theme mode to localStorage', () => {
  const controller = createController();

  jest.clearAllMocks();

  controller.setThemeMode(ThemeMode.DARK);

  expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
  expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
    'superset-theme-mode',
    ThemeMode.DARK,
  );
});

test('ThemeController loads saved theme mode from localStorage', () => {
  mockLocalStorage.getItem.mockReturnValue(ThemeMode.DARK);

  const controller = createController();

  expect(controller.getCurrentMode()).toBe(ThemeMode.DARK);
});

test('ThemeController handles invalid saved theme mode', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: {},
      dark: {},
    }),
  );

  mockLocalStorage.getItem.mockReturnValue('invalid-mode' as any);

  const controller = createController();

  expect(controller.getCurrentMode()).toBe(ThemeMode.DEFAULT);
});

// Theme Structure tests

test('ThemeController handles theme with token structure', () => {
  const controller = createController();

  const customTheme = {
    token: {
      colorBgBase: '#ff0000',
      colorTextBase: '#ffffff',
      colorPrimary: '#00ff00',
    },
  };

  jest.clearAllMocks();

  controller.setTheme(customTheme);

  expect(mockSetConfig).toHaveBeenCalledTimes(1);
  expect(mockSetConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      token: expect.objectContaining({
        colorBgBase: '#ff0000',
        colorTextBase: '#ffffff',
        colorPrimary: '#00ff00',
      }),
    }),
  );
});

test('ThemeController preserves algorithm property from dark theme', () => {
  const controller = createController();

  jest.clearAllMocks();

  controller.setThemeMode(ThemeMode.DARK);

  expect(mockSetConfig).toHaveBeenCalledTimes(1);
  expect(mockSetConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      algorithm: antdThemeImport.darkAlgorithm,
      token: expect.objectContaining({
        colorBgBase: '#141118',
        colorTextBase: '#fdc7c7',
      }),
    }),
  );
});

test('ThemeController handles theme without algorithm property', () => {
  const controller = createController();

  jest.clearAllMocks();

  controller.setThemeMode(ThemeMode.DEFAULT);

  expect(mockSetConfig).toHaveBeenCalledTimes(1);
  expect(mockSetConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      token: expect.objectContaining({
        colorBgBase: '#ededed',
        colorTextBase: '#120f0f',
      }),
    }),
  );

  const lastCall =
    mockSetConfig.mock.calls[mockSetConfig.mock.calls.length - 1][0];

  expect(lastCall.algorithm).toBe(antdThemeImport.defaultAlgorithm);
});

test('ThemeController handles color tokens correctly in theme switching', () => {
  const controller = createController();

  controller.setThemeMode(ThemeMode.DEFAULT);

  let lastCall =
    mockSetConfig.mock.calls[mockSetConfig.mock.calls.length - 1][0];

  expect(lastCall.token.colorBgBase).toBe('#ededed');
  expect(lastCall.token.colorTextBase).toBe('#120f0f');

  controller.setThemeMode(ThemeMode.DARK);

  lastCall = mockSetConfig.mock.calls[mockSetConfig.mock.calls.length - 1][0];

  expect(lastCall.token.colorBgBase).toBe('#141118');
  expect(lastCall.token.colorTextBase).toBe('#fdc7c7');
});

// Algorithm Combinations tests
test('ThemeController handles valid algorithm combinations', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: {
        ...DEFAULT_THEME,
        algorithm: [ThemeAlgorithm.DARK, ThemeAlgorithm.COMPACT],
      },
      dark: DARK_THEME,
    }),
  );

  const controller = createController();

  const themeWithAlgorithm = {
    ...DEFAULT_THEME,
    algorithm: [
      ThemeAlgorithm.DARK,
      ThemeAlgorithm.COMPACT,
    ] as ThemeAlgorithm[],
  };

  jest.clearAllMocks();

  controller.setTheme(themeWithAlgorithm);

  expect(mockSetConfig).toHaveBeenCalledTimes(1);
  expect(mockSetConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      token: expect.objectContaining({
        colorBgBase: '#ededed',
        colorPrimary: '#c96f0f',
      }),
      algorithm: [
        antdThemeImport.darkAlgorithm,
        antdThemeImport.compactAlgorithm,
      ],
    }),
  );
});

test('ThemeController handles invalid algorithm combinations', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: {
        ...DEFAULT_THEME,
        algorithm: [ThemeAlgorithm.DARK, ThemeAlgorithm.COMPACT],
      },
      dark: DARK_THEME,
    }),
  );

  const controller = createController();

  const themeWithInvalidAlgorithm = {
    ...DEFAULT_THEME,
    algorithm: ['invalid', 'combination'] as any as ThemeAlgorithm[],
  };

  jest.clearAllMocks();

  controller.setTheme(themeWithInvalidAlgorithm);

  expect(mockSetConfig).toHaveBeenCalledTimes(1);
  expect(mockSetConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      algorithm: antdThemeImport.defaultAlgorithm,
    }),
  );
});

// Change Callbacks tests
test('ThemeController calls callback on theme change', () => {
  const callback = jest.fn();
  const controller = createController({ onChange: callback });

  controller.setThemeMode(ThemeMode.DARK);

  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(mockThemeObject);
});

test('ThemeController registers additional callbacks', () => {
  const callback = jest.fn();
  const controller = createController({ onChange: callback });

  const additionalCallback = jest.fn();
  controller.onChange(additionalCallback);

  controller.setThemeMode(ThemeMode.DARK);

  expect(callback).toHaveBeenCalled();
  expect(additionalCallback).toHaveBeenCalled();
});

test('ThemeController unsubscribes callbacks', () => {
  const callback = jest.fn();
  const controller = createController({ onChange: callback });

  const additionalCallback = jest.fn();
  const unsubscribe = controller.onChange(additionalCallback);

  unsubscribe();
  controller.setThemeMode(ThemeMode.DARK);

  expect(additionalCallback).not.toHaveBeenCalled();
});

test('ThemeController handles callback errors', () => {
  const callback = jest.fn();
  const controller = createController({ onChange: callback });

  const errorCallback = jest.fn().mockImplementation(() => {
    throw new Error('Callback error');
  });

  controller.onChange(errorCallback);
  controller.setThemeMode(ThemeMode.DARK);

  expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    'Error in theme change callback:',
    expect.any(Error),
  );
});

// Error Handling tests

test('ThemeController handles theme application errors', () => {
  const controller = createController();

  mockSetConfig.mockImplementationOnce(() => {
    throw new Error('Theme application error');
  });

  const fallbackSpy = jest.spyOn(controller as any, 'fallbackToDefaultMode');
  fallbackSpy.mockImplementation(() => {
    (controller as any).customizations = DEFAULT_THEME;
    (controller as any).currentMode = ThemeMode.DEFAULT;
  });

  controller.setThemeMode(ThemeMode.DARK);

  expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    'Failed to apply theme:',
    expect.any(Error),
  );
  expect(fallbackSpy).toHaveBeenCalled();

  fallbackSpy.mockRestore();
});

test('ThemeController constructor recovers from corrupted stored theme', () => {
  // Simulate corrupted dev theme override in storage
  const corruptedTheme = { token: { colorPrimary: '#ff0000' } };
  mockLocalStorage.getItem.mockImplementation((key: string) => {
    if (key === 'superset-dev-theme-override') {
      return JSON.stringify(corruptedTheme);
    }
    return null;
  });

  // Mock Theme.fromConfig to return object with toSerializedConfig
  mockThemeFromConfig.mockReturnValue({
    ...mockThemeObject,
    toSerializedConfig: () => corruptedTheme,
  });

  // First call throws (corrupted theme), second call succeeds (fallback)
  let callCount = 0;
  mockSetConfig.mockImplementation(() => {
    callCount += 1;
    if (callCount === 1) {
      throw new Error('Invalid theme configuration');
    }
  });

  // Should not throw - constructor should recover
  const controller = createController();

  // Verify recovery happened - use shared consoleSpy to avoid interfering with other tests
  expect(consoleSpy).toHaveBeenCalledWith(
    'Failed to apply stored theme, clearing invalid overrides:',
    expect.any(Error),
  );

  // Verify invalid overrides were cleared from storage
  expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
    'superset-dev-theme-override',
  );
  expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
    'superset-crud-theme-id',
  );
  expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
    'superset-applied-theme-id',
  );

  // Verify controller is in a valid state
  expect(controller.getCurrentMode()).toBe(ThemeMode.DEFAULT);
});

test('recovery flow: fetchSystemDefaultTheme returns theme → applies fetched theme', async () => {
  // Test: fallbackToDefaultMode fetches theme from API and applies it
  // Flow: fallbackToDefaultMode → fetchSystemDefaultTheme → applyThemeWithRecovery

  const originalFetch = global.fetch;
  const controller = createController();

  try {
    // Mock fetch to return a system default theme from API
    const systemTheme = { token: { colorPrimary: '#recovery-theme' } };
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: [{ json_data: JSON.stringify(systemTheme) }],
      }),
    });
    global.fetch = mockFetch;

    // Track setConfig calls to verify the fetched theme is applied
    const setConfigCalls: unknown[] = [];
    mockSetConfig.mockImplementation((config: unknown) => {
      setConfigCalls.push(config);
    });

    // Trigger fallbackToDefaultMode (simulates what happens after applyTheme fails)
    await (controller as any).fallbackToDefaultMode();

    // Verify API was called to fetch system default theme
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/theme/'),
    );

    // Verify the fetched theme was applied via applyThemeWithRecovery
    expect(setConfigCalls.length).toBe(1);
    expect(setConfigCalls[0]).toEqual(
      expect.objectContaining({
        token: expect.objectContaining({ colorPrimary: '#recovery-theme' }),
      }),
    );

    // Verify controller is in default mode
    expect(controller.getCurrentMode()).toBe(ThemeMode.DEFAULT);
  } finally {
    global.fetch = originalFetch;
  }
});

test('recovery flow: both API fetches fail → falls back to cached default theme', async () => {
  // Test: When fetchSystemDefaultTheme fails, fallbackToDefaultMode uses cached theme
  // Flow: fallbackToDefaultMode → fetchSystemDefaultTheme (fails) → applyTheme(cached)

  const originalFetch = global.fetch;
  const controller = createController();

  try {
    // Mock fetch to fail for both API endpoints
    const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = mockFetch;

    // Track setConfig calls
    const setConfigCalls: unknown[] = [];
    mockSetConfig.mockImplementation((config: unknown) => {
      setConfigCalls.push(config);
    });

    // Trigger fallbackToDefaultMode
    await (controller as any).fallbackToDefaultMode();

    // Verify fetch was attempted
    expect(mockFetch).toHaveBeenCalled();

    // Verify fallback to cached default theme was applied via applyTheme
    expect(setConfigCalls.length).toBe(1);
    expect(setConfigCalls[0]).toEqual(
      expect.objectContaining({
        token: expect.objectContaining({
          colorBgBase: '#ededed', // From DEFAULT_THEME in test setup
        }),
      }),
    );

    // Verify controller is in default mode
    expect(controller.getCurrentMode()).toBe(ThemeMode.DEFAULT);
  } finally {
    global.fetch = originalFetch;
  }
});

test('recovery flow: fetched theme fails to apply → falls back to cached default', async () => {
  // Test: When applyThemeWithRecovery fails, fallbackToDefaultMode uses cached theme
  // Flow: fallbackToDefaultMode → fetchSystemDefaultTheme → applyThemeWithRecovery (fails) → applyTheme(cached)

  const originalFetch = global.fetch;
  const controller = createController();

  try {
    // Mock fetch to return a theme
    const systemTheme = { token: { colorPrimary: '#bad-theme' } };
    const mockFetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: [{ json_data: JSON.stringify(systemTheme) }],
      }),
    });
    global.fetch = mockFetch;

    // First setConfig call (applyThemeWithRecovery) fails, second (applyTheme) succeeds
    const setConfigCalls: unknown[] = [];
    mockSetConfig.mockImplementation((config: unknown) => {
      setConfigCalls.push(config);
      if (setConfigCalls.length === 1) {
        throw new Error('Fetched theme failed to apply');
      }
    });

    // Trigger fallbackToDefaultMode
    await (controller as any).fallbackToDefaultMode();

    // Verify fetch was called
    expect(mockFetch).toHaveBeenCalled();

    // Verify both attempts were made: fetched theme (failed) then cached default
    expect(setConfigCalls.length).toBe(2);

    // First call was the fetched theme (which failed)
    expect(setConfigCalls[0]).toEqual(
      expect.objectContaining({
        token: expect.objectContaining({ colorPrimary: '#bad-theme' }),
      }),
    );

    // Second call was the cached default theme
    expect(setConfigCalls[1]).toEqual(
      expect.objectContaining({
        token: expect.objectContaining({
          colorBgBase: '#ededed', // From DEFAULT_THEME
        }),
      }),
    );

    // Verify controller is in default mode
    expect(controller.getCurrentMode()).toBe(ThemeMode.DEFAULT);
  } finally {
    global.fetch = originalFetch;
  }
});

// Cleanup tests
test('ThemeController cleans up listeners on destroy', () => {
  const mockMediaQueryInstance = {
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  mockMatchMedia.mockReturnValue(mockMediaQueryInstance);

  const controller = createController();

  controller.destroy();

  expect(mockMediaQueryInstance.removeEventListener).toHaveBeenCalledTimes(1);
  expect(mockMediaQueryInstance.removeEventListener).toHaveBeenCalledWith(
    'change',
    expect.any(Function),
  );
});

// setThemeConfig tests
test('setThemeConfig sets complete theme configuration', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: {},
      dark: {},
    }),
  );

  const controller = createController({ defaultTheme: { token: {} } });

  jest.clearAllMocks();

  const themeConfig = {
    theme_default: DEFAULT_THEME,
    theme_dark: DARK_THEME,
  };

  controller.setThemeConfig(themeConfig);

  expect(mockSetConfig).toHaveBeenCalledTimes(1);
  expect(mockSetConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      token: expect.objectContaining(DEFAULT_THEME.token),
      algorithm: antdThemeImport.defaultAlgorithm,
    }),
  );

  expect(controller.getCurrentMode()).toBe(ThemeMode.DEFAULT);
  expect(controller.canSetTheme()).toBe(true);
  expect(controller.canSetMode()).toBe(true);
});

test('setThemeConfig handles theme_default only', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: {},
      dark: {},
    }),
  );

  const controller = createController({ defaultTheme: { token: {} } });

  jest.clearAllMocks();

  const themeConfig = {
    theme_default: DEFAULT_THEME,
  };

  controller.setThemeConfig(themeConfig);

  expect(mockSetConfig).toHaveBeenCalledTimes(1);
  expect(mockSetConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      token: expect.objectContaining(DEFAULT_THEME.token),
      algorithm: antdThemeImport.defaultAlgorithm,
    }),
  );

  expect(controller.canSetTheme()).toBe(true);
  expect(controller.canSetMode()).toBe(false);
});

test('setThemeConfig handles theme_default and theme_dark without settings', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: {},
      dark: {},
    }),
  );

  const controller = createController({ defaultTheme: { token: {} } });

  jest.clearAllMocks();

  const themeConfig = {
    theme_default: DEFAULT_THEME,
    theme_dark: DARK_THEME,
  };

  controller.setThemeConfig(themeConfig);

  expect(mockSetConfig).toHaveBeenCalledTimes(1);
  expect(mockSetConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      token: expect.objectContaining(DEFAULT_THEME.token),
    }),
  );

  jest.clearAllMocks();
  controller.setThemeMode(ThemeMode.DARK);

  expect(mockSetConfig).toHaveBeenCalledTimes(1);
  expect(mockSetConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      token: expect.objectContaining(DARK_THEME.token),
      algorithm: antdThemeImport.darkAlgorithm,
    }),
  );
});

test('setThemeConfig applies appropriate theme after configuration', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: {},
      dark: {},
    }),
  );

  const controller = createController({ defaultTheme: { token: {} } });

  jest.clearAllMocks();

  const themeConfig = {
    theme_default: {
      token: {
        colorPrimary: '#00ff00',
      },
    },
    theme_dark: {
      token: {
        colorPrimary: '#ff0000',
        colorBgBase: '#000000',
      },
      algorithm: 'dark',
    },
  };

  controller.setThemeConfig(themeConfig as SupersetThemeConfig);

  expect(mockSetConfig).toHaveBeenCalledTimes(1);
  expect(mockSetConfig).toHaveBeenCalledWith(
    expect.objectContaining({
      token: expect.objectContaining({
        colorPrimary: '#00ff00',
      }),
      algorithm: antdThemeImport.defaultAlgorithm,
    }),
  );
});

test('setThemeConfig handles missing theme_dark gracefully', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: {},
      dark: {},
    }),
  );

  const controller = createController({ defaultTheme: { token: {} } });

  const themeConfig = {
    theme_default: DEFAULT_THEME,
  };

  controller.setThemeConfig(themeConfig);

  expect(controller.canSetMode()).toBe(false);
});

test('setThemeConfig preserves existing theme mode when possible', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: DEFAULT_THEME,
      dark: DARK_THEME,
    }),
  );

  const controller = createController();

  controller.setThemeMode(ThemeMode.DARK);
  const initialMode = controller.getCurrentMode();

  jest.clearAllMocks();

  const themeConfig = {
    theme_default: DEFAULT_THEME,
    theme_dark: DARK_THEME,
  };

  controller.setThemeConfig(themeConfig);

  expect(controller.getCurrentMode()).toBe(initialMode);
});

test('setThemeConfig triggers onChange callbacks', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: {},
      dark: {},
    }),
  );

  const controller = createController({ defaultTheme: { token: {} } });

  const changeCallback = jest.fn();
  controller.onChange(changeCallback);

  const themeConfig = {
    theme_default: DEFAULT_THEME,
    theme_dark: DARK_THEME,
  };

  controller.setThemeConfig(themeConfig);

  expect(changeCallback).toHaveBeenCalledTimes(1);
  expect(changeCallback).toHaveBeenCalledWith(mockThemeObject);
});

test('setThemeConfig handles error in theme application', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: {},
      dark: {},
    }),
  );

  const controller = createController({ defaultTheme: { token: {} } });

  mockSetConfig.mockImplementationOnce(() => {
    throw new Error('Theme application error');
  });

  const themeConfig = {
    theme_default: DEFAULT_THEME,
  };

  expect(() => {
    controller.setThemeConfig(themeConfig);
  }).not.toThrow();

  expect(consoleErrorSpy).toHaveBeenCalledWith(
    'Failed to apply theme:',
    expect.any(Error),
  );
});

test('setThemeConfig updates stored theme mode', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: {},
      dark: {},
    }),
  );

  const controller = createController({ defaultTheme: { token: {} } });

  const themeConfig = {
    theme_default: DEFAULT_THEME,
    theme_dark: DARK_THEME,
  };

  controller.setThemeConfig(themeConfig);

  expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
    'superset-theme-mode',
    expect.any(String),
  );
});

// Override and applied theme ID tests
test('setThemeMode clears dev override and crud theme from storage', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: DEFAULT_THEME,
      dark: DARK_THEME,
    }),
  );

  mockLocalStorage.getItem.mockReturnValue(null);

  const controller = new ThemeController({
    storage: mockLocalStorage,
    themeObject: mockThemeObject,
  });

  Reflect.set(controller, 'devThemeOverride', {
    token: { colorPrimary: '#ff0000' },
  });
  Reflect.set(controller, 'crudThemeId', '123');

  jest.clearAllMocks();

  controller.setThemeMode(ThemeMode.DARK);

  expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
    'superset-dev-theme-override',
  );
  expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
    'superset-crud-theme-id',
  );
});

test('setThemeMode can be called with same mode when overrides exist', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: DEFAULT_THEME,
      dark: DARK_THEME,
    }),
  );

  mockLocalStorage.getItem.mockReturnValue(null);

  const controller = new ThemeController({
    storage: mockLocalStorage,
    themeObject: mockThemeObject,
  });

  jest.clearAllMocks();

  Reflect.set(controller, 'devThemeOverride', {
    token: { colorPrimary: '#ff0000' },
  });

  controller.setThemeMode(ThemeMode.DEFAULT);

  expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
    'superset-dev-theme-override',
  );
  expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
    'superset-crud-theme-id',
  );

  expect(mockSetConfig).toHaveBeenCalled();
});

test('setThemeMode with no override and same mode does not trigger update', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: DEFAULT_THEME,
      dark: DARK_THEME,
    }),
  );

  const controller = new ThemeController({
    storage: mockLocalStorage,
    themeObject: mockThemeObject,
  });

  controller.setThemeMode(ThemeMode.DEFAULT);

  jest.clearAllMocks();

  controller.setThemeMode(ThemeMode.DEFAULT);

  expect(mockSetConfig).not.toHaveBeenCalled();
  expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
});

test('hasDevOverride returns true when dev override is set', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: DEFAULT_THEME,
      dark: DARK_THEME,
    }),
  );

  mockLocalStorage.getItem.mockReturnValue(null);

  const controller = new ThemeController({
    storage: mockLocalStorage,
    themeObject: mockThemeObject,
  });

  Reflect.set(controller, 'devThemeOverride', {
    token: { colorPrimary: '#ff0000' },
  });

  expect(controller.hasDevOverride()).toBe(true);
});

test('hasDevOverride returns false when no dev override in storage', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: DEFAULT_THEME,
      dark: DARK_THEME,
    }),
  );

  mockLocalStorage.getItem.mockReturnValue(null);

  const controller = new ThemeController({
    storage: mockLocalStorage,
    themeObject: mockThemeObject,
  });

  expect(controller.hasDevOverride()).toBe(false);
});

test('clearLocalOverrides removes dev override, crud theme, and applied theme ID', () => {
  mockGetBootstrapData.mockReturnValue(
    createMockBootstrapData({
      default: DEFAULT_THEME,
      dark: DARK_THEME,
    }),
  );

  mockLocalStorage.getItem.mockReturnValue(null);

  const controller = new ThemeController({
    storage: mockLocalStorage,
    themeObject: mockThemeObject,
  });

  jest.clearAllMocks();

  controller.clearLocalOverrides();

  expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
    'superset-dev-theme-override',
  );
  expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
    'superset-crud-theme-id',
  );
  expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
    'superset-applied-theme-id',
  );

  expect(mockSetConfig).toHaveBeenCalled();
});

test('getAppliedThemeId returns stored theme ID', () => {
  mockLocalStorage.getItem.mockImplementation((key: string) => {
    if (key === 'superset-applied-theme-id') {
      return '42';
    }
    return null;
  });

  const controller = new ThemeController({
    storage: mockLocalStorage,
    themeObject: mockThemeObject,
  });

  expect(controller.getAppliedThemeId()).toBe(42);
});

test('getAppliedThemeId returns null when no theme ID is stored', () => {
  mockLocalStorage.getItem.mockReturnValue(null);

  const controller = new ThemeController({
    storage: mockLocalStorage,
    themeObject: mockThemeObject,
  });

  expect(controller.getAppliedThemeId()).toBeNull();
});

test('setAppliedThemeId stores theme ID in storage', () => {
  const controller = new ThemeController({
    storage: mockLocalStorage,
    themeObject: mockThemeObject,
  });

  jest.clearAllMocks();

  controller.setAppliedThemeId(123);

  expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
    'superset-applied-theme-id',
    '123',
  );
});

test('setAppliedThemeId removes theme ID when null is passed', () => {
  const controller = new ThemeController({
    storage: mockLocalStorage,
    themeObject: mockThemeObject,
  });

  jest.clearAllMocks();

  controller.setAppliedThemeId(null);

  expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
    'superset-applied-theme-id',
  );
});

// Font loading tests
test('font loading: injects font URLs as CSS @import when theme has fontUrls', () => {
  document
    .querySelectorAll('style[data-superset-fonts]')
    .forEach(el => el.remove());
  const fontController = new ThemeController({ themeObject: mockThemeObject });

  const themeWithFonts = {
    token: {
      colorPrimary: '#ff0000',
      fontUrls: ['https://fonts.googleapis.com/css2?family=Roboto'],
    },
  };
  fontController.setTheme(themeWithFonts);

  const style = document.querySelector('style[data-superset-fonts]');
  expect(style).toBeTruthy();
  expect(style?.textContent).toContain(
    '@import url("https://fonts.googleapis.com/css2?family=Roboto")',
  );

  document
    .querySelectorAll('style[data-superset-fonts]')
    .forEach(el => el.remove());
});

test('font loading: injects multiple font URLs', () => {
  document
    .querySelectorAll('style[data-superset-fonts]')
    .forEach(el => el.remove());
  const fontController = new ThemeController({ themeObject: mockThemeObject });

  const themeWithFonts = {
    token: {
      colorPrimary: '#ff0000',
      fontUrls: [
        'https://fonts.googleapis.com/css2?family=Roboto',
        'https://fonts.googleapis.com/css2?family=Open+Sans',
      ],
    },
  };
  fontController.setTheme(themeWithFonts);

  const style = document.querySelector('style[data-superset-fonts]');
  expect(style).toBeTruthy();
  expect(style?.textContent).toContain(
    '@import url("https://fonts.googleapis.com/css2?family=Roboto")',
  );
  expect(style?.textContent).toContain(
    '@import url("https://fonts.googleapis.com/css2?family=Open+Sans")',
  );

  document
    .querySelectorAll('style[data-superset-fonts]')
    .forEach(el => el.remove());
});

test('font loading: does not duplicate font URLs when same theme applied twice', () => {
  document
    .querySelectorAll('style[data-superset-fonts]')
    .forEach(el => el.remove());
  const fontController = new ThemeController({ themeObject: mockThemeObject });

  const themeWithFonts = {
    token: {
      colorPrimary: '#ff0000',
      fontUrls: ['https://fonts.googleapis.com/css2?family=Roboto'],
    },
  };
  fontController.setTheme(themeWithFonts);
  fontController.setTheme(themeWithFonts);

  const styles = document.querySelectorAll('style[data-superset-fonts]');
  expect(styles.length).toBe(1);

  document
    .querySelectorAll('style[data-superset-fonts]')
    .forEach(el => el.remove());
});

test('font loading: does not inject styles when fontUrls is empty array', () => {
  document
    .querySelectorAll('style[data-superset-fonts]')
    .forEach(el => el.remove());
  const fontController = new ThemeController({ themeObject: mockThemeObject });

  const themeWithEmptyFonts = {
    token: {
      colorPrimary: '#ff0000',
      fontUrls: [],
    },
  };
  fontController.setTheme(themeWithEmptyFonts);

  const style = document.querySelector('style[data-superset-fonts]');
  expect(style).toBeNull();

  document
    .querySelectorAll('style[data-superset-fonts]')
    .forEach(el => el.remove());
});

test('font loading: does not inject styles when fontUrls is undefined', () => {
  document
    .querySelectorAll('style[data-superset-fonts]')
    .forEach(el => el.remove());
  const fontController = new ThemeController({ themeObject: mockThemeObject });

  const themeWithoutFonts = {
    token: {
      colorPrimary: '#ff0000',
    },
  };
  fontController.setTheme(themeWithoutFonts);

  const style = document.querySelector('style[data-superset-fonts]');
  expect(style).toBeNull();

  document
    .querySelectorAll('style[data-superset-fonts]')
    .forEach(el => el.remove());
});

test('font loading: adds new font URLs when switching themes', () => {
  document
    .querySelectorAll('style[data-superset-fonts]')
    .forEach(el => el.remove());
  const fontController = new ThemeController({ themeObject: mockThemeObject });

  const theme1 = {
    token: {
      colorPrimary: '#ff0000',
      fontUrls: ['https://fonts.googleapis.com/css2?family=Roboto'],
    },
  };
  const theme2 = {
    token: {
      colorPrimary: '#00ff00',
      fontUrls: ['https://fonts.googleapis.com/css2?family=Open+Sans'],
    },
  };

  fontController.setTheme(theme1);
  fontController.setTheme(theme2);

  const styles = document.querySelectorAll('style[data-superset-fonts]');
  expect(styles.length).toBe(2);

  const allContent = Array.from(styles)
    .map(s => s.textContent)
    .join('');
  expect(allContent).toContain('Roboto');
  expect(allContent).toContain('Open+Sans');

  document
    .querySelectorAll('style[data-superset-fonts]')
    .forEach(el => el.remove());
});
