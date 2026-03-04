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
import { type ReactNode } from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import { logging } from '@apache-superset/core';
import { Theme } from '@apache-superset/core/ui';
import CrudThemeProvider from './CrudThemeProvider';

const MockSupersetThemeProvider = ({ children }: { children: ReactNode }) => (
  <div data-test="dashboard-theme-provider">{children}</div>
);

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(Theme, 'fromConfig').mockReturnValue({
    SupersetThemeProvider: MockSupersetThemeProvider,
  } as unknown as Theme);
});

test('renders children directly when no theme is provided', () => {
  render(
    <CrudThemeProvider>
      <div>Dashboard Content</div>
    </CrudThemeProvider>,
  );
  expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  expect(
    screen.queryByTestId('dashboard-theme-provider'),
  ).not.toBeInTheDocument();
  expect(Theme.fromConfig).not.toHaveBeenCalled();
});

test('renders children directly when theme is null', () => {
  render(
    <CrudThemeProvider theme={null}>
      <div>Dashboard Content</div>
    </CrudThemeProvider>,
  );
  expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  expect(
    screen.queryByTestId('dashboard-theme-provider'),
  ).not.toBeInTheDocument();
  expect(Theme.fromConfig).not.toHaveBeenCalled();
});

test('wraps children with SupersetThemeProvider when valid theme data is provided', () => {
  const themeConfig = { token: { colorPrimary: '#ff0000' } };
  render(
    <CrudThemeProvider
      theme={{
        id: 1,
        theme_name: 'Custom Theme',
        json_data: JSON.stringify(themeConfig),
      }}
    >
      <div>Dashboard Content</div>
    </CrudThemeProvider>,
  );
  expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  expect(screen.getByTestId('dashboard-theme-provider')).toBeInTheDocument();
  expect(Theme.fromConfig).toHaveBeenCalledWith(themeConfig);
});

test('creates theme from inline json_data via Theme.fromConfig', () => {
  const themeConfig = { token: { colorPrimary: '#1677ff' } };
  render(
    <CrudThemeProvider
      theme={{
        id: 42,
        theme_name: 'Branded',
        json_data: JSON.stringify(themeConfig),
      }}
    >
      <div>Dashboard Content</div>
    </CrudThemeProvider>,
  );
  expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  // No API call can happen — CrudThemeProvider has no fetch/SupersetClient imports.
  // Theme is created synchronously from the inline json_data prop.
  expect(Theme.fromConfig).toHaveBeenCalledWith(themeConfig);
});

test('falls back to rendering children without theme wrapper when json_data is invalid JSON', () => {
  jest.spyOn(logging, 'warn').mockImplementation();
  render(
    <CrudThemeProvider
      theme={{ id: 1, theme_name: 'Bad Theme', json_data: 'not-valid-json' }}
    >
      <div>Dashboard Content</div>
    </CrudThemeProvider>,
  );
  expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  expect(
    screen.queryByTestId('dashboard-theme-provider'),
  ).not.toBeInTheDocument();
  expect(logging.warn).toHaveBeenCalled();
});

test('falls back to rendering children without theme wrapper when Theme.fromConfig throws', () => {
  (Theme.fromConfig as jest.Mock).mockImplementation(() => {
    throw new Error('Invalid theme config');
  });
  jest.spyOn(logging, 'warn').mockImplementation();
  render(
    <CrudThemeProvider
      theme={{ id: 1, theme_name: 'Bad Theme', json_data: '{}' }}
    >
      <div>Dashboard Content</div>
    </CrudThemeProvider>,
  );
  expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  expect(
    screen.queryByTestId('dashboard-theme-provider'),
  ).not.toBeInTheDocument();
  expect(logging.warn).toHaveBeenCalled();
});
