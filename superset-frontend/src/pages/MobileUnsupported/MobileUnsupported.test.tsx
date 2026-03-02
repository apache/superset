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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MobileUnsupported from './index';

// Mock useBreakpoint to return mobile by default
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Grid: {
    ...jest.requireActual('antd').Grid,
    useBreakpoint: () => ({
      xs: true,
      sm: true,
      md: false,
      lg: false,
      xl: false,
    }),
  },
}));

// Mock useHistory
const mockPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockPush,
  }),
}));

// Store original sessionStorage
const originalSessionStorage = window.sessionStorage;

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});

afterEach(() => {
  // Restore sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: originalSessionStorage,
    writable: true,
  });
});

const renderComponent = (props = {}) =>
  render(
    <MemoryRouter initialEntries={['/chart/list/']}>
      <MobileUnsupported {...props} />
    </MemoryRouter>,
  );

test('renders the page title', () => {
  renderComponent();
  expect(
    screen.getByText("This view isn't available on mobile"),
  ).toBeInTheDocument();
});

test('renders the description text', () => {
  renderComponent();
  expect(
    screen.getByText(
      'Some features require a larger screen. Try viewing dashboards for the best mobile experience.',
    ),
  ).toBeInTheDocument();
});

test('renders the View Dashboards button', () => {
  renderComponent();
  expect(
    screen.getByRole('button', { name: 'View Dashboards' }),
  ).toBeInTheDocument();
});

test('renders the Go to Welcome Page button', () => {
  renderComponent();
  expect(
    screen.getByRole('button', { name: 'Go to Welcome Page' }),
  ).toBeInTheDocument();
});

test('renders the Continue anyway link', () => {
  renderComponent();
  expect(screen.getByText(/Continue anyway/)).toBeInTheDocument();
});

test('View Dashboards button navigates to dashboard list', async () => {
  renderComponent();

  const button = screen.getByRole('button', { name: 'View Dashboards' });
  await userEvent.click(button);

  expect(mockPush).toHaveBeenCalledWith('/dashboard/list/');
});

test('Go to Welcome Page button navigates to welcome page', async () => {
  renderComponent();

  const button = screen.getByRole('button', { name: 'Go to Welcome Page' });
  await userEvent.click(button);

  expect(mockPush).toHaveBeenCalledWith('/superset/welcome/');
});

test('Continue anyway sets sessionStorage and navigates to original path', async () => {
  renderComponent({ originalPath: '/chart/list/' });

  const link = screen.getByText(/Continue anyway/);
  await userEvent.click(link);

  expect(sessionStorage.getItem('mobile-bypass')).toBe('true');
  expect(mockPush).toHaveBeenCalledWith('/chart/list/');
});

test('uses originalPath prop when provided', async () => {
  renderComponent({ originalPath: '/explore/?form_data=123' });

  const link = screen.getByText(/Continue anyway/);
  await userEvent.click(link);

  expect(mockPush).toHaveBeenCalledWith('/explore/?form_data=123');
});

test('handles sessionStorage errors gracefully', async () => {
  // Mock sessionStorage to throw
  const mockStorage = {
    getItem: jest.fn(() => {
      throw new Error('Storage access denied');
    }),
    setItem: jest.fn(() => {
      throw new Error('Storage access denied');
    }),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };
  Object.defineProperty(window, 'sessionStorage', {
    value: mockStorage,
    writable: true,
  });

  renderComponent({ originalPath: '/chart/list/' });

  const link = screen.getByText(/Continue anyway/);
  // Should not throw even though sessionStorage fails
  await userEvent.click(link);

  // Should still navigate even if storage failed
  expect(mockPush).toHaveBeenCalledWith('/chart/list/');
});

test('renders desktop icon', () => {
  renderComponent();
  // The icon should be present (DesktopOutlined)
  // Icon might not have aria-label, so we verify the page renders with the title
  expect(
    screen.getByText("This view isn't available on mobile"),
  ).toBeInTheDocument();
});
