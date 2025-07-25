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
import { type ThemeContextType, Theme, ThemeMode } from '@superset-ui/core';
import { act, render, screen } from '@superset-ui/core/spec';
import { renderHook } from '@testing-library/react-hooks';
import { SupersetThemeProvider, useThemeContext } from '../ThemeProvider';
import { ThemeController } from '../ThemeController';

jest.mock('../ThemeController');
const MockThemeController = ThemeController as jest.MockedClass<
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
  (controller: jest.Mocked<ThemeController>) =>
  ({ children }: { children: ReactNode }) => (
    <SupersetThemeProvider themeController={controller}>
      {children}
    </SupersetThemeProvider>
  );

describe('SupersetThemeProvider', () => {
  let mockThemeController: jest.Mocked<ThemeController>;
  let mockOnChangeCallback: jest.Mock;

  beforeEach(() => {
    mockOnChangeCallback = jest.fn();
    mockThemeController = {
      getTheme: jest.fn().mockReturnValue(mockTheme),
      getCurrentMode: jest.fn().mockReturnValue(ThemeMode.DEFAULT),
      setTheme: jest.fn(),
      setThemeMode: jest.fn(),
      resetTheme: jest.fn(),
      onChange: jest.fn().mockReturnValue(jest.fn()),
      canUpdateTheme: jest.fn().mockReturnValue(true),
      canUpdateMode: jest.fn().mockReturnValue(true),
      destroy: jest.fn(),
    } as unknown as jest.Mocked<ThemeController>;

    mockThemeController.onChange.mockImplementation(callback => {
      mockOnChangeCallback.mockImplementation(callback);
      return jest.fn();
    });

    MockThemeController.mockImplementation(() => mockThemeController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider Initialization', () => {
    it('should render children within theme provider wrapper', () => {
      render(
        <SupersetThemeProvider themeController={mockThemeController}>
          <div data-test="test-child">Hello Superset</div>
        </SupersetThemeProvider>,
      );

      expect(screen.getByTestId('superset-theme-provider')).toBeInTheDocument();
      expect(screen.getByTestId('test-child')).toBeInTheDocument();
    });

    it('should initialize theme state from controller', () => {
      const wrapper = createWrapper(mockThemeController);

      const { result } = renderHook((): ThemeContextType => useThemeContext(), {
        wrapper,
      });

      expect(mockThemeController.getTheme).toHaveBeenCalled();
      expect(mockThemeController.getCurrentMode).toHaveBeenCalled();
      expect(result.current.theme).toBe(mockTheme);
      expect(result.current.themeMode).toBe(ThemeMode.DEFAULT);
    });

    it('should register onChange listener on mount', () => {
      const wrapper = createWrapper(mockThemeController);

      renderHook((): ThemeContextType => useThemeContext(), { wrapper });

      expect(mockThemeController.onChange).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('should unregister onChange listener on unmount', () => {
      const unsubscribeMock = jest.fn();
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

  describe('Theme State Updates', () => {
    it('should update theme state when controller notifies change', () => {
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

    it('should update both theme and mode when controller changes', () => {
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

  describe('Theme Actions', () => {
    it('should call setTheme when invoked', () => {
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

    it('should call setThemeMode when invoked', () => {
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

    it('should call resetTheme when invoked', () => {
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
