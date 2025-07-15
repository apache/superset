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
import { Theme } from '@superset-ui/core';
import type {
  BootstrapThemeDataConfig,
  CommonBootstrapData,
} from 'src/types/bootstrapTypes';
import { ThemeAlgorithm, ThemeMode } from '@superset-ui/core/theme/types';
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
const DEFAULT_THEME = {
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

const DARK_THEME = {
  token: {
    colorBgBase: '#141118',
    colorTextBase: '#fdc7c7',
    colorLink: '#0062ec',
    colorPrimary: '#c96f0f',
    colorInfo: '#c96f0f',
    colorSuccess: '#3c7c1b',
    colorWarning: '#dc9811',
  },
  algorithm: ThemeMode.DARK,
};

const THEME_SETTINGS = {
  enforced: false,
  allowSwitching: true,
  allowOSPreference: true,
};

// BootstrapData common template generator
const createMockBootstrapData = (
  themeConfig: BootstrapThemeDataConfig = {
    default: DEFAULT_THEME,
    dark: DARK_THEME,
    settings: THEME_SETTINGS,
  },
): { common: CommonBootstrapData } => ({
  common: {
    application_root: '/',
    static_assets_prefix: '/static/assets/',
    flash_messages: [],
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

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

  beforeEach(() => {
    adapter = new LocalStorageAdapter();
    jest.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  it('should return item from localStorage', () => {
    mockLocalStorage.getItem.mockReturnValue('test-value');

    const result = adapter.getItem('test-key');

    expect(mockLocalStorage.getItem).toHaveBeenCalledTimes(1);
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('test-key');
    expect(result).toBe('test-value');
  });

  it('should set item in localStorage', () => {
    adapter.setItem('test-key', 'test-value');

    expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'test-key',
      'test-value',
    );
  });

  it('should handle localStorage errors while setting an item', () => {
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

  it('should remove item from localStorage', () => {
    adapter.removeItem('test-key');

    expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(1);
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test-key');
  });

  it('should handle localStorage errors while removing an item', () => {
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
});

describe('ThemeController', () => {
  let controller: ThemeController;
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

  it('should initialize with default options', () => {
    controller = new ThemeController({
      themeObject: mockThemeObject,
    });

    expect(controller.getTheme()).toBe(mockThemeObject);
  });

  it('should use BootsrapData themes when available', () => {
    controller = new ThemeController({
      themeObject: mockThemeObject,
    });

    expect(mockThemeFromConfig).toHaveBeenCalledTimes(1);
    expect(mockThemeFromConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.objectContaining({
          colorBgBase: '#ededed',
          colorPrimary: '#c96f0f',
        }),
      }),
    );
  });

  it('should fallback to Superset default theme when BootsrapData themes are empty', () => {
    mockGetBootstrapData.mockReturnValue(
      createMockBootstrapData({
        default: {},
        dark: {},
        settings: {},
      }),
    );

    const fallbackTheme = {
      token: {
        colorBgBase: '#ffffff',
        colorPrimary: '#1890ff',
      },
    };

    controller = new ThemeController({
      themeObject: mockThemeObject,
      defaultTheme: fallbackTheme,
    });

    expect(mockThemeFromConfig).toHaveBeenCalledTimes(1);
    expect(mockThemeFromConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        ...fallbackTheme,
        algorithm: antdThemeImport.defaultAlgorithm,
      }),
    );
  });

  it('should respect enforced theme settings', () => {
    mockGetBootstrapData.mockReturnValue(
      createMockBootstrapData({
        default: {},
        dark: {},
        settings: { enforced: true, allowSwitching: false },
      }),
    );

    mockLocalStorage.getItem.mockReturnValue(ThemeMode.DARK);

    controller = new ThemeController({
      themeObject: mockThemeObject,
    });

    expect(controller.getCurrentMode()).toBe(ThemeMode.DEFAULT);
    expect(controller.canSetTheme()).toBe(false);
    expect(controller.canSetMode()).toBe(false);
  });

  it('should handle system theme preference', () => {
    mockGetBootstrapData.mockReturnValue(
      createMockBootstrapData({
        default: {},
        dark: {},
        settings: { allowOSPreference: true },
      }),
    );

    controller = new ThemeController({
      themeObject: mockThemeObject,
    });

    expect(controller.getCurrentMode()).toBe(ThemeMode.SYSTEM);
  });

  it('should handle only default theme', () => {
    mockGetBootstrapData.mockReturnValue(
      createMockBootstrapData({
        default: DEFAULT_THEME,
        dark: {},
        settings: {},
      }),
    );

    controller = new ThemeController({
      themeObject: mockThemeObject,
    });

    // Clear the call from initialization
    jest.clearAllMocks();

    controller.setThemeMode(ThemeMode.DARK);

    expect(mockSetConfig).toHaveBeenCalledTimes(1);
    expect(mockSetConfig).toHaveBeenCalledWith(
      expect.objectContaining(DEFAULT_THEME),
    );
  });

  it('should handle only dark theme', () => {
    mockGetBootstrapData.mockReturnValue(
      createMockBootstrapData({
        default: {},
        dark: DARK_THEME,
        settings: {},
      }),
    );

    controller = new ThemeController({
      themeObject: mockThemeObject,
    });

    expect(mockSetConfig).toHaveBeenCalledTimes(1);
    expect(mockSetConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        ...DARK_THEME,
        algorithm: antdThemeImport.darkAlgorithm,
      }),
    );
  });

  it('should handle only settings', () => {
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
        settings: { enforced: true },
      }),
    );

    controller = new ThemeController({
      themeObject: mockThemeObject,
      defaultTheme: fallbackTheme,
    });

    expect(controller.canSetTheme()).toBe(false);
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

  it('should handle completely empty BootstrapData', () => {
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
        settings: {},
      }),
    );

    controller = new ThemeController({
      themeObject: mockThemeObject,
      defaultTheme: fallbackTheme,
    });

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

  it('should handle missing theme object', () => {
    const fallbackTheme = { token: { colorPrimary: '#fallback' } };

    mockGetBootstrapData.mockReturnValue({
      common: {
        application_root: '/',
        static_assets_prefix: '/static/assets/',
        flash_messages: [],
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

    controller = new ThemeController({
      themeObject: mockThemeObject,
      defaultTheme: fallbackTheme,
    });

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

  it('should allow theme switching if there is no bootstrap themes', () => {
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
        settings: {},
      }),
    );

    controller = new ThemeController({
      themeObject: mockThemeObject,
      defaultTheme: fallbackTheme,
    });

    // Clear initialization calls
    jest.clearAllMocks();

    // Switch to dark mode
    controller.setThemeMode(ThemeMode.DARK);

    expect(mockSetConfig).toHaveBeenCalledTimes(1);
    expect(mockSetConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        ...fallbackTheme,
        algorithm: antdThemeImport.darkAlgorithm,
      }),
    );
  });

  describe('Theme Management', () => {
    beforeEach(() => {
      controller = new ThemeController({
        themeObject: mockThemeObject,
      });
    });

    it('should update theme when allowed', () => {
      const newTheme = {
        token: {
          colorBgBase: '#000000',
          colorPrimary: '#ff0000',
        },
      };

      controller.setTheme(newTheme);

      expect(mockSetConfig).toHaveBeenCalledWith(
        expect.objectContaining(newTheme),
      );
    });

    it('should throw error when theme updates are not allowed', () => {
      mockGetBootstrapData.mockReturnValue(
        createMockBootstrapData({
          default: {},
          dark: {},
          settings: { enforced: true },
        }),
      );

      controller = new ThemeController({
        themeObject: mockThemeObject,
      });

      expect(() => {
        controller.setTheme({
          token: {
            colorBgBase: '#000000',
            colorPrimary: '#ff0000',
          },
        });
      }).toThrow('User does not have permission to update the theme');
    });

    it('should change theme mode when allowed', () => {
      // Clear initialization calls
      jest.clearAllMocks();

      controller.setThemeMode(ThemeMode.DARK);

      expect(controller.getCurrentMode()).toBe(ThemeMode.DARK);
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'superset-theme-mode',
        ThemeMode.DARK,
      );
    });

    it('should throw error when mode updates are not allowed but OS preference is', () => {
      mockGetBootstrapData.mockReturnValue(
        createMockBootstrapData({
          default: DEFAULT_THEME,
          dark: DARK_THEME,
          settings: { allowSwitching: false },
        }),
      );

      controller = new ThemeController({
        themeObject: mockThemeObject,
      });

      expect(() => {
        controller.setThemeMode(ThemeMode.DARK);
      }).toThrow(
        'Theme mode changes are not allowed when OS preference is enforced',
      );
    });

    it('should throw error when mode updates and OS preference are not allowed', () => {
      mockGetBootstrapData.mockReturnValue(
        createMockBootstrapData({
          default: DEFAULT_THEME,
          dark: DARK_THEME,
          settings: { allowOSPreference: false, allowSwitching: false },
        }),
      );

      controller = new ThemeController({
        themeObject: mockThemeObject,
      });

      expect(() => {
        controller.setThemeMode(ThemeMode.DARK);
      }).toThrow('User does not have permission to update the theme mode');
    });

    it('should throw error when system mode is not allowed', () => {
      mockGetBootstrapData.mockReturnValue(
        createMockBootstrapData({
          default: DEFAULT_THEME,
          dark: DARK_THEME,
          settings: {
            allowOSPreference: false,
            allowSwitching: true,
            enforced: false,
          },
        }),
      );

      controller = new ThemeController({
        themeObject: mockThemeObject,
      });

      expect(() => {
        controller.setThemeMode(ThemeMode.SYSTEM);
      }).toThrow('System theme mode is not allowed');
    });

    it('should handle missing theme gracefully', () => {
      mockGetBootstrapData.mockReturnValue(
        createMockBootstrapData({
          default: DEFAULT_THEME,
          dark: {},
          settings: THEME_SETTINGS,
        }),
      );

      controller = new ThemeController({
        themeObject: mockThemeObject,
      });

      controller.setThemeMode(ThemeMode.DARK);

      expect(controller.getCurrentMode()).toBe(ThemeMode.DARK);
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should not change mode if already set', () => {
      controller = new ThemeController({
        themeObject: mockThemeObject,
      });

      jest.clearAllMocks();

      // Try to change to the same mode (DEFAULT)
      controller.setThemeMode(ThemeMode.SYSTEM);

      // Should not call setItem since mode didn't change
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('should reset to default theme', () => {
      controller.setThemeMode(ThemeMode.DARK);
      controller.resetTheme();

      expect(controller.getCurrentMode()).toBe(ThemeMode.DEFAULT);
      expect(mockSetConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          token: expect.objectContaining({
            colorBgBase: '#141118',
            colorTextBase: '#fdc7c7',
          }),
        }),
      );
    });
  });

  describe('System Theme Changes', () => {
    let mockMediaQuery: any;

    beforeEach(() => {
      mockMediaQuery = {
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };

      mockMatchMedia.mockReturnValue(mockMediaQuery);

      controller = new ThemeController({
        themeObject: mockThemeObject,
      });
    });

    it('should listen to system theme changes', () => {
      expect(mockMediaQuery.addEventListener).toHaveBeenCalledTimes(1);
      expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
    });

    it('should update theme when system preference changes and mode is SYSTEM', () => {
      controller.setThemeMode(ThemeMode.SYSTEM);

      // Simulate system theme change
      mockMediaQuery.matches = true;
      const changeHandler = mockMediaQuery.addEventListener.mock.calls[0][1];

      changeHandler();

      expect(mockSetConfig).toHaveBeenCalled();
    });

    it('should not update theme when mode is not SYSTEM', () => {
      controller.setThemeMode(ThemeMode.DEFAULT);

      const initialCallCount = mockSetConfig.mock.calls.length;

      // Simulate system theme change
      mockMediaQuery.matches = true;
      const changeHandler = mockMediaQuery.addEventListener.mock.calls[0][1];

      changeHandler();

      expect(mockSetConfig).toHaveBeenCalledTimes(initialCallCount);
    });
  });

  describe('Persistence', () => {
    beforeEach(() => {
      controller = new ThemeController({
        themeObject: mockThemeObject,
      });
    });

    it('should save theme mode to localStorage', () => {
      // Clear the call from controller initialization
      jest.clearAllMocks();

      controller.setThemeMode(ThemeMode.DARK);

      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'superset-theme-mode',
        ThemeMode.DARK,
      );
    });

    it('should load saved theme mode from localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue(ThemeMode.DARK);

      controller = new ThemeController({
        themeObject: mockThemeObject,
      });

      expect(controller.getCurrentMode()).toBe(ThemeMode.DARK);
    });

    it('should handle invalid saved theme mode', () => {
      mockGetBootstrapData.mockReturnValue(
        createMockBootstrapData({
          default: {},
          dark: {},
          settings: { allowOSPreference: false },
        }),
      );

      mockLocalStorage.getItem.mockReturnValue('invalid-mode' as any);

      controller = new ThemeController({
        themeObject: mockThemeObject,
      });

      expect(controller.getCurrentMode()).toBe(ThemeMode.DEFAULT);
    });
  });

  describe('Theme Structure', () => {
    beforeEach(() => {
      controller = new ThemeController({
        themeObject: mockThemeObject,
      });
    });

    it('should handle theme with token structure', () => {
      const customTheme = {
        token: {
          colorBgBase: '#ff0000',
          colorTextBase: '#ffffff',
          colorPrimary: '#00ff00',
        },
      };

      // Clear the call from controller initialization
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

    it('should preserve algorithm property from dark theme', () => {
      // Clear the call from controller initialization
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

    it('should handle theme without algorithm property', () => {
      // Clear the call from controller initialization
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

      // Should not have algorithm property or should be overridden
      const lastCall =
        mockSetConfig.mock.calls[mockSetConfig.mock.calls.length - 1][0];

      expect(lastCall.algorithm).toBe(antdThemeImport.defaultAlgorithm);
    });

    it('should handle color tokens correctly in theme switching', () => {
      // Start with default theme
      controller.setThemeMode(ThemeMode.DEFAULT);

      let lastCall =
        mockSetConfig.mock.calls[mockSetConfig.mock.calls.length - 1][0];

      expect(lastCall.token.colorBgBase).toBe('#ededed');
      expect(lastCall.token.colorTextBase).toBe('#120f0f');

      // Switch to dark theme
      controller.setThemeMode(ThemeMode.DARK);

      lastCall =
        mockSetConfig.mock.calls[mockSetConfig.mock.calls.length - 1][0];

      expect(lastCall.token.colorBgBase).toBe('#141118');
      expect(lastCall.token.colorTextBase).toBe('#fdc7c7');
    });
  });

  describe('Algorithm Combinations', () => {
    beforeEach(() => {
      mockGetBootstrapData.mockReturnValue(
        createMockBootstrapData({
          default: {
            ...DEFAULT_THEME,
            algorithm: [ThemeAlgorithm.DARK, ThemeAlgorithm.COMPACT],
          },
          dark: DARK_THEME,
          settings: THEME_SETTINGS,
        }),
      );

      controller = new ThemeController({
        themeObject: mockThemeObject,
      });
    });

    it('should handle valid algorithm combinations', () => {
      const themeWithAlgorithm = {
        ...DEFAULT_THEME,
        algorithm: [
          ThemeAlgorithm.DARK,
          ThemeAlgorithm.COMPACT,
        ] as ThemeAlgorithm[],
      };

      // Clear the call from controller initialization
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

    it('should handle invalid algorithm combinations', () => {
      const themeWithInvalidAlgorithm = {
        ...DEFAULT_THEME,
        algorithm: ['invalid', 'combination'] as any as ThemeAlgorithm[],
      };

      // Clear the call from controller initialization
      jest.clearAllMocks();

      controller.setTheme(themeWithInvalidAlgorithm);

      expect(mockSetConfig).toHaveBeenCalledTimes(1);
      expect(mockSetConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          algorithm: antdThemeImport.defaultAlgorithm,
        }),
      );
    });
  });

  describe('Change Callbacks', () => {
    let callback: jest.Mock;
    let unsubscribe: () => void;

    beforeEach(() => {
      callback = jest.fn();
      controller = new ThemeController({
        themeObject: mockThemeObject,
        onChange: callback,
      });
    });

    it('should call callback on theme change', () => {
      controller.setThemeMode(ThemeMode.DARK);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(mockThemeObject);
    });

    it('should register additional callbacks', () => {
      const additionalCallback = jest.fn();
      unsubscribe = controller.onChange(additionalCallback);

      controller.setThemeMode(ThemeMode.DARK);

      expect(callback).toHaveBeenCalled();
      expect(additionalCallback).toHaveBeenCalled();
    });

    it('should unsubscribe callbacks', () => {
      const additionalCallback = jest.fn();
      unsubscribe = controller.onChange(additionalCallback);

      unsubscribe();
      controller.setThemeMode(ThemeMode.DARK);

      expect(additionalCallback).not.toHaveBeenCalled();
    });

    it('should handle callback errors', () => {
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
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      controller = new ThemeController({
        themeObject: mockThemeObject,
      });
    });

    it('should handle theme application errors', () => {
      // Mock setConfig to throw an error
      mockSetConfig.mockImplementationOnce(() => {
        throw new Error('Theme application error');
      });

      // Mock fallbackToDefaultMode to avoid infinite recursion
      const fallbackSpy = jest.spyOn(
        controller as any,
        'fallbackToDefaultMode',
      );
      fallbackSpy.mockImplementation(() => {
        // Just set basic properties without calling updateTheme
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
  });

  describe('Cleanup', () => {
    let mockMediaQueryInstance: any;

    beforeEach(() => {
      mockMediaQueryInstance = {
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      };

      mockMatchMedia.mockReturnValue(mockMediaQueryInstance);

      controller = new ThemeController({
        themeObject: mockThemeObject,
      });
    });

    it('should clean up listeners on destroy', () => {
      controller.destroy();

      expect(mockMediaQueryInstance.removeEventListener).toHaveBeenCalledTimes(
        1,
      );
      expect(mockMediaQueryInstance.removeEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
    });
  });
});
