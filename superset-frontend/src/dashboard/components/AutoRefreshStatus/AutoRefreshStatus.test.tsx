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
import { AutoRefreshStatus as AutoRefreshStatusComponent } from './index';
import {
  AutoRefreshStatus,
  AUTO_REFRESH_STATE_DEFAULTS,
} from '../../types/autoRefresh';

// Helper to create mock state for rendering with Redux
const createMockState = (overrides = {}) => ({
  dashboardState: {
    ...AUTO_REFRESH_STATE_DEFAULTS,
    refreshFrequency: 0,
    ...overrides,
  },
});

test('does not render when refreshFrequency is 0', () => {
  render(<AutoRefreshStatusComponent />, {
    useRedux: true,
    initialState: createMockState({ refreshFrequency: 0 }),
  });
  expect(screen.queryByTestId('auto-refresh-status')).not.toBeInTheDocument();
});

test('renders when refreshFrequency is greater than 0', () => {
  render(<AutoRefreshStatusComponent />, {
    useRedux: true,
    initialState: createMockState({ refreshFrequency: 5 }),
  });
  expect(screen.getByTestId('auto-refresh-status')).toBeInTheDocument();
});

test('renders status indicator dot', () => {
  render(<AutoRefreshStatusComponent />, {
    useRedux: true,
    initialState: createMockState({
      refreshFrequency: 5,
      autoRefreshStatus: AutoRefreshStatus.Success,
    }),
  });
  expect(screen.getByTestId('status-indicator-dot')).toBeInTheDocument();
});

test('shows paused status when manually paused', () => {
  render(<AutoRefreshStatusComponent />, {
    useRedux: true,
    initialState: createMockState({
      refreshFrequency: 5,
      autoRefreshPaused: true,
      autoRefreshStatus: AutoRefreshStatus.Success,
    }),
  });
  const dot = screen.getByTestId('status-indicator-dot');
  expect(dot).toHaveAttribute('data-status', AutoRefreshStatus.Paused);
});

test('shows paused status when paused by tab', () => {
  render(<AutoRefreshStatusComponent />, {
    useRedux: true,
    initialState: createMockState({
      refreshFrequency: 5,
      autoRefreshPausedByTab: true,
      autoRefreshStatus: AutoRefreshStatus.Fetching,
    }),
  });
  const dot = screen.getByTestId('status-indicator-dot');
  expect(dot).toHaveAttribute('data-status', AutoRefreshStatus.Paused);
});

test('shows fetching status when fetching', () => {
  render(<AutoRefreshStatusComponent />, {
    useRedux: true,
    initialState: createMockState({
      refreshFrequency: 5,
      autoRefreshStatus: AutoRefreshStatus.Fetching,
    }),
  });
  const dot = screen.getByTestId('status-indicator-dot');
  expect(dot).toHaveAttribute('data-status', AutoRefreshStatus.Fetching);
});

test('shows error status after 2+ consecutive errors', () => {
  render(<AutoRefreshStatusComponent />, {
    useRedux: true,
    initialState: createMockState({
      refreshFrequency: 5,
      autoRefreshStatus: AutoRefreshStatus.Error,
      refreshErrorCount: 2,
    }),
  });
  const dot = screen.getByTestId('status-indicator-dot');
  expect(dot).toHaveAttribute('data-status', AutoRefreshStatus.Error);
});

test('shows delayed status after one refresh error', () => {
  render(<AutoRefreshStatusComponent />, {
    useRedux: true,
    initialState: createMockState({
      refreshFrequency: 5,
      autoRefreshStatus: AutoRefreshStatus.Success,
      refreshErrorCount: 1,
    }),
  });
  const dot = screen.getByTestId('status-indicator-dot');
  expect(dot).toHaveAttribute('data-status', AutoRefreshStatus.Delayed);
});

test('accepts className prop', () => {
  render(<AutoRefreshStatusComponent className="custom-class" />, {
    useRedux: true,
    initialState: createMockState({ refreshFrequency: 5 }),
  });
  const container = screen.getByTestId('auto-refresh-status');
  expect(container).toHaveClass('custom-class');
});
