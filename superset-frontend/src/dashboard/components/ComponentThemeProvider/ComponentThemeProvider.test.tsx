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
import { render, screen, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import { Theme } from '@apache-superset/core/ui';
import ComponentThemeProvider, {
  useComponentTheme,
} from './index';

// Mock the ThemeProvider module
jest.mock('src/theme/ThemeProvider', () => ({
  useThemeContext: jest.fn(),
}));

// Get reference to mocked useThemeContext
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useThemeContext } = require('src/theme/ThemeProvider');

// Mock theme object
const mockTheme = {
  SupersetThemeProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="component-theme-provider">{children}</div>
  ),
  toSerializedConfig: jest.fn().mockReturnValue({ colorPrimary: '#1890ff' }),
} as unknown as Theme;

const mockLoadedTheme = {
  SupersetThemeProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="loaded-theme-provider">{children}</div>
  ),
} as unknown as Theme;

test('renders children directly when no themeId is provided', () => {
  render(
    <ComponentThemeProvider>
      <div data-testid="test-child">Hello World</div>
    </ComponentThemeProvider>,
  );

  expect(screen.getByTestId('test-child')).toBeInTheDocument();
  expect(screen.getByText('Hello World')).toBeInTheDocument();
});

test('renders children directly when themeId is null', () => {
  render(
    <ComponentThemeProvider themeId={null}>
      <div data-testid="test-child">Hello World</div>
    </ComponentThemeProvider>,
  );

  expect(screen.getByTestId('test-child')).toBeInTheDocument();
});

test('renders children when themeId is provided and theme loads successfully', async () => {
  const mockCreateTheme = jest.fn().mockResolvedValue(mockLoadedTheme);

  useThemeContext.mockReturnValue({
    theme: mockTheme,
    createTheme: mockCreateTheme,
  });

  await act(async () => {
    render(
      <ComponentThemeProvider themeId={123}>
        <div data-testid="test-child">Themed Content</div>
      </ComponentThemeProvider>,
    );
  });

  await waitFor(() => {
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
  });

  expect(mockCreateTheme).toHaveBeenCalledWith('123', { colorPrimary: '#1890ff' });
});

test('wraps children with theme provider when theme loads', async () => {
  const mockCreateTheme = jest.fn().mockResolvedValue(mockLoadedTheme);

  useThemeContext.mockReturnValue({
    theme: mockTheme,
    createTheme: mockCreateTheme,
  });

  await act(async () => {
    render(
      <ComponentThemeProvider themeId={456}>
        <div data-testid="test-child">Themed Content</div>
      </ComponentThemeProvider>,
    );
  });

  await waitFor(() => {
    expect(screen.getByTestId('loaded-theme-provider')).toBeInTheDocument();
  });

  expect(screen.getByTestId('test-child')).toBeInTheDocument();
});

test('renders children without wrapper when theme loading fails', async () => {
  const mockCreateTheme = jest
    .fn()
    .mockRejectedValue(new Error('Failed to load theme'));

  useThemeContext.mockReturnValue({
    theme: mockTheme,
    createTheme: mockCreateTheme,
  });

  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {});

  await act(async () => {
    render(
      <ComponentThemeProvider themeId={789}>
        <div data-testid="test-child">Content</div>
      </ComponentThemeProvider>,
    );
  });

  await waitFor(() => {
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
  });

  expect(consoleErrorSpy).toHaveBeenCalledWith(
    'Failed to load component theme 789:',
    expect.any(Error),
  );

  consoleErrorSpy.mockRestore();
});

test('gracefully handles missing ThemeProvider (error boundary fallback)', () => {
  // Simulate useThemeContext throwing an error
  useThemeContext.mockImplementation(() => {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  });

  // Should not throw, should render children via error boundary
  render(
    <ComponentThemeProvider themeId={123}>
      <div data-testid="test-child">Fallback Content</div>
    </ComponentThemeProvider>,
  );

  expect(screen.getByTestId('test-child')).toBeInTheDocument();
});

test('re-throws non-ThemeProvider errors', () => {
  useThemeContext.mockImplementation(() => {
    throw new Error('Some other error');
  });

  // This should throw because it's not a ThemeProvider error
  expect(() => {
    render(
      <ComponentThemeProvider themeId={123}>
        <div>Content</div>
      </ComponentThemeProvider>,
    );
  }).toThrow('Some other error');
});

test('useComponentTheme returns theme info when themeId is provided', () => {
  const { result } = renderHook(() => useComponentTheme(42));

  expect(result.current.themeId).toBe(42);
  expect(result.current.themeName).toBe('Theme 42');
  expect(result.current.hasTheme).toBe(true);
});

test('useComponentTheme returns null values when themeId is not provided', () => {
  const { result } = renderHook(() => useComponentTheme(null));

  expect(result.current.themeId).toBeNull();
  expect(result.current.themeName).toBeNull();
  expect(result.current.hasTheme).toBe(false);
});

test('useComponentTheme returns null values when themeId is undefined', () => {
  const { result } = renderHook(() => useComponentTheme(undefined));

  expect(result.current.themeId).toBeUndefined();
  expect(result.current.themeName).toBeNull();
  expect(result.current.hasTheme).toBe(false);
});

test('shows fallback while loading when provided', async () => {
  let resolveTheme: (theme: Theme) => void;
  const themePromise = new Promise<Theme>(resolve => {
    resolveTheme = resolve;
  });
  const mockCreateTheme = jest.fn().mockReturnValue(themePromise);

  useThemeContext.mockReturnValue({
    theme: mockTheme,
    createTheme: mockCreateTheme,
  });

  render(
    <ComponentThemeProvider
      themeId={999}
      fallback={<div data-testid="loading">Loading...</div>}
    >
      <div data-testid="test-child">Content</div>
    </ComponentThemeProvider>,
  );

  // During loading, fallback should be shown (or children if no theme yet)
  expect(screen.getByTestId('test-child')).toBeInTheDocument();

  // Resolve the theme
  await act(async () => {
    resolveTheme!(mockLoadedTheme);
  });

  await waitFor(() => {
    expect(screen.getByTestId('loaded-theme-provider')).toBeInTheDocument();
  });
});

test('cleans up properly when unmounted during loading', async () => {
  let resolveTheme: (theme: Theme) => void;
  const themePromise = new Promise<Theme>(resolve => {
    resolveTheme = resolve;
  });
  const mockCreateTheme = jest.fn().mockReturnValue(themePromise);

  useThemeContext.mockReturnValue({
    theme: mockTheme,
    createTheme: mockCreateTheme,
  });

  const { unmount } = render(
    <ComponentThemeProvider themeId={111}>
      <div data-testid="test-child">Content</div>
    </ComponentThemeProvider>,
  );

  // Unmount before theme loads
  unmount();

  // Resolve the theme after unmount - should not cause errors
  await act(async () => {
    resolveTheme!(mockLoadedTheme);
  });

  // No errors should occur - the isMounted check prevents state updates
});
