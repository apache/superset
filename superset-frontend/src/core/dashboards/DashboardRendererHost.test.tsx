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
import { act, render, screen, cleanup } from 'spec/helpers/testing-library';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import type { dashboards } from '@apache-superset/core';
import DashboardRendererProviders from './DashboardRendererProviders';
import DashboardRendererHost from './DashboardRendererHost';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));
const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;

// Stub the built-in renderer to avoid mounting the full dashboard stack
jest.mock(
  'src/dashboard/components/DashboardRenderer/DefaultDashboardRenderer',
  () => ({
    __esModule: true,
    default: ({ dashboard }: dashboards.DashboardRendererProps) => (
      <div data-test="default-dashboard-renderer">
        <span data-test="default-renderer-dashboard-id">{dashboard.id}</span>
      </div>
    ),
  }),
);

const rendererProps: dashboards.DashboardRendererProps = {
  dashboard: {
    id: 42,
    title: 'Test dashboard',
    metadata: {},
    layout: {},
  },
  charts: [{ id: 7, slice_name: 'Test chart' }],
  datasets: [{ id: 3, table_name: 'test_table' }],
  initialDataMask: {
    'NATIVE_FILTER-abc': {
      id: 'NATIVE_FILTER-abc',
      filterState: { value: ['foo'] },
    },
  },
};

beforeEach(() => {
  DashboardRendererProviders.getInstance().reset();
  mockIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.EnableExtensions,
  );
});

afterEach(() => {
  mockIsFeatureEnabled.mockReset();
  cleanup();
});

test('renders the built-in renderer when no custom renderer is registered', () => {
  render(<DashboardRendererHost {...rendererProps} />);

  expect(screen.getByTestId('default-dashboard-renderer')).toBeInTheDocument();
  expect(screen.getByTestId('default-renderer-dashboard-id')).toHaveTextContent(
    '42',
  );
});

test('renders a registered custom renderer with the contract props', () => {
  const customRenderer = jest.fn(
    ({ dashboard, initialDataMask }: dashboards.DashboardRendererProps) => (
      <div data-test="custom-dashboard-renderer">
        {dashboard.title}
        {Object.keys(initialDataMask).join(',')}
      </div>
    ),
  );
  DashboardRendererProviders.getInstance().registerProvider(
    { id: 'test.custom', name: 'Custom Renderer' },
    customRenderer,
  );

  render(<DashboardRendererHost {...rendererProps} />);

  expect(screen.getByTestId('custom-dashboard-renderer')).toHaveTextContent(
    'Test dashboard',
  );
  expect(screen.getByTestId('custom-dashboard-renderer')).toHaveTextContent(
    'NATIVE_FILTER-abc',
  );
  expect(customRenderer).toHaveBeenCalledWith(
    expect.objectContaining({
      dashboard: expect.objectContaining({ id: 42 }),
      charts: rendererProps.charts,
      datasets: rendererProps.datasets,
      initialDataMask: rendererProps.initialDataMask,
    }),
    expect.anything(),
  );
  expect(
    screen.queryByTestId('default-dashboard-renderer'),
  ).not.toBeInTheDocument();
});

test('renders the built-in renderer in edit mode even with a custom renderer registered', () => {
  DashboardRendererProviders.getInstance().registerProvider(
    { id: 'test.custom', name: 'Custom Renderer' },
    () => <div data-test="custom-dashboard-renderer" />,
  );

  render(<DashboardRendererHost editMode {...rendererProps} />);

  expect(screen.getByTestId('default-dashboard-renderer')).toBeInTheDocument();
  expect(
    screen.queryByTestId('custom-dashboard-renderer'),
  ).not.toBeInTheDocument();
});

test('renders the built-in renderer when the extensions feature flag is off', () => {
  mockIsFeatureEnabled.mockReturnValue(false);
  DashboardRendererProviders.getInstance().registerProvider(
    { id: 'test.custom', name: 'Custom Renderer' },
    () => <div data-test="custom-dashboard-renderer" />,
  );

  render(<DashboardRendererHost {...rendererProps} />);

  expect(screen.getByTestId('default-dashboard-renderer')).toBeInTheDocument();
  expect(
    screen.queryByTestId('custom-dashboard-renderer'),
  ).not.toBeInTheDocument();
});

test('shows an error boundary when the custom renderer throws', () => {
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  DashboardRendererProviders.getInstance().registerProvider(
    { id: 'test.broken', name: 'Broken Renderer' },
    () => {
      throw new Error('renderer exploded');
    },
  );

  render(<DashboardRendererHost {...rendererProps} />);

  expect(screen.getByText('Unexpected error')).toBeInTheDocument();
  expect(
    screen.queryByTestId('default-dashboard-renderer'),
  ).not.toBeInTheDocument();

  consoleErrorSpy.mockRestore();
});

test('swaps to a custom renderer registered after mount', () => {
  render(<DashboardRendererHost {...rendererProps} />);

  expect(screen.getByTestId('default-dashboard-renderer')).toBeInTheDocument();

  act(() => {
    DashboardRendererProviders.getInstance().registerProvider(
      { id: 'test.late', name: 'Late Renderer' },
      () => <div data-test="custom-dashboard-renderer" />,
    );
  });

  expect(screen.getByTestId('custom-dashboard-renderer')).toBeInTheDocument();
  expect(
    screen.queryByTestId('default-dashboard-renderer'),
  ).not.toBeInTheDocument();
});
