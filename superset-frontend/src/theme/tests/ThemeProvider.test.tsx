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
import { ReactNode } from 'react';
import {
  type ThemeContextType,
  Theme,
  ThemeMode,
} from '@apache-superset/core/theme';
import { act, render, screen } from '@superset-ui/core/spec';
import { renderHook } from '@testing-library/react-hooks';
import { SupersetThemeProvider, useThemeContext } from '../ThemeProvider';
import { ThemeController } from '../ThemeController';
import { Mock } from 'vitest';

vi.mock('../ThemeController');
const MockThemeController = ThemeController as Mock<
  typeof ThemeController
>;

// Mock theme objects
const mockTheme = {
  SupersetThemeProvider: ({ children }: { children: ReactNode }) => (
    <div data-test="superset-theme-provider">{children}</div>
  ),
  theme: {
    token: {
      colorPrimary: '#1890ff',
      colorBgBase: '#ffffff',
    },
  },
} as unknown as Theme;

const mockDarkTheme = {
  SupersetThemeProvider: ({ children }: { children: ReactNode }) => (
    <div data-test="superset-dark-theme-provider">{children}</div>
  ),
  theme: {
    token: {
      colorPrimary: '#1890ff',
      colorBgBase: '#000000',
    },
  },
} as unknown as Theme;

const createWrapper =
  (controller: any) =>
  ({ children }: { children: ReactNode }) => (
    <SupersetThemeProvider themeController={controller}>
      {children}
    </SupersetThemeProvider>
  );

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('SupersetThemeProvider', () => {
  let mockThemeController: any;
  let mockOnChangeCallback: any;

  beforeEach(() => {
    mockOnChangeCallback = vi.fn();
    mockThemeController = {
      getTheme: vi.fn().mockReturnValue(mockTheme),
      getCurrentMode: vi.fn().mockReturnValue(ThemeMode.DEFAULT),
      setTheme: vi.fn(),
      setThemeMode: vi.fn(),
      resetTheme: vi.fn(),
      onChange: vi.fn().mockReturnValue(vi.fn()),
      canUpdateTheme: vi.fn().mockReturnValue(true),
      canUpdateMode: vi.fn().mockReturnValue(true),
      destroy: vi.fn(),
    } as unknown as Mock;

    mockThemeController.onChange.mockImplementation((callback: any) => {
      mockOnChangeCallback.mockImplementation(callback);
      return vi.fn();
    });

    MockThemeController.mockImplementation(() => mockThemeController);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('Provider Initialization', () => {
    test('should render children within theme provider wrapper', () => {
      render(
        <SupersetThemeProvider themeController={mockThemeController}>
          <div data-test="test-child">Hello Superset</div>
        </SupersetThemeProvider>,
      );

      expect(screen.getByTestId('superset-theme-provider')).toBeInTheDocument();
      expect(screen.getByTestId('test-child')).toBeInTheDocument();
    });

    test('should initialize theme state from controller', () => {
      const wrapper = createWrapper(mockThemeController);

      const { result } = renderHook((): ThemeContextType => useThemeContext(), {
        wrapper,
      });

      expect(mockThemeController.getTheme).toHaveBeenCalled();
      expect(mockThemeController.getCurrentMode).toHaveBeenCalled();
      expect(result.current.theme).toBe(mockTheme);
      expect(result.current.themeMode).toBe(ThemeMode.DEFAULT);
    });

    test('should register onChange listener on mount', () => {
      const wrapper = createWrapper(mockThemeController);

      renderHook((): ThemeContextType => useThemeContext(), { wrapper });

      expect(mockThemeController.onChange).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    test('should unregister onChange listener on unmount', () => {
      const unsubscribeMock = vi.fn();
      mockThemeController.onChange.mockReturnValue(unsubscribeMock);

      const wrapper = createWrapper(mockThemeController);

      const { unmount } = renderHook(
        (): ThemeContextType => useThemeContext(),
        { wrapper },
      );

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('Theme State Updates', () => {
    test('should update theme state when controller notifies change', () => {
      const wrapper = createWrapper(mockThemeController);

      const { result } = renderHook((): ThemeContextType => useThemeContext(), {
        wrapper,
      });

      // Initial state
      expect(result.current.themeMode).toBe(ThemeMode.DEFAULT);
      expect(result.current.theme).toBe(mockTheme);

      // Simulate theme change from controller
      act(() => {
        mockThemeController.getCurrentMode.mockReturnValue(ThemeMode.DARK);
        mockOnChangeCallback(mockDarkTheme);
      });

      // State should update
      expect(result.current.themeMode).toBe(ThemeMode.DARK);
      expect(result.current.theme).toBe(mockDarkTheme);
    });

    test('should update both theme and mode when controller changes', () => {
      const wrapper = createWrapper(mockThemeController);

      const { result } = renderHook((): ThemeContextType => useThemeContext(), {
        wrapper,
      });

      act(() => {
        mockThemeController.getCurrentMode.mockReturnValue(ThemeMode.SYSTEM);
        mockOnChangeCallback(mockDarkTheme);
      });

      expect(result.current.themeMode).toBe(ThemeMode.SYSTEM);
      expect(result.current.theme).toBe(mockDarkTheme);
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('Theme Actions', () => {
    test('should call setTheme when invoked', () => {
      const wrapper = createWrapper(mockThemeController);

      const { result } = renderHook((): ThemeContextType => useThemeContext(), {
        wrapper,
      });

      const customTheme = {
        token: {
          colorPrimary: '#ff0000',
          colorBgBase: '#000000',
        },
      };

      act(() => {
        result.current.setTheme(customTheme);
      });

      expect(mockThemeController.setTheme).toHaveBeenCalledWith(customTheme);
    });

    test('should call setThemeMode when invoked', () => {
      const wrapper = createWrapper(mockThemeController);

      const { result } = renderHook((): ThemeContextType => useThemeContext(), {
        wrapper,
      });

      act(() => {
        result.current.setThemeMode(ThemeMode.DARK);
      });

      expect(mockThemeController.setThemeMode).toHaveBeenCalledWith(
        ThemeMode.DARK,
      );
    });

    test('should call resetTheme when invoked', () => {
      const wrapper = createWrapper(mockThemeController);

      const { result } = renderHook((): ThemeContextType => useThemeContext(), {
        wrapper,
      });

      act(() => {
        result.current.resetTheme();
      });

      expect(mockThemeController.resetTheme).toHaveBeenCalled();
    });
  });
});
