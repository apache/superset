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
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import { AutoRefreshControls } from './index';
import {
  AutoRefreshStatus,
  AUTO_REFRESH_STATE_DEFAULTS,
} from '../../types/autoRefresh';

// Helper to create mock state
const createMockState = (overrides = {}) => ({
  dashboardState: {
    ...AUTO_REFRESH_STATE_DEFAULTS,
    refreshFrequency: 0,
    ...overrides,
  },
});

test('does not render when refreshFrequency is 0', () => {
  const onTogglePause = jest.fn();
  render(<AutoRefreshControls onTogglePause={onTogglePause} />, {
    useRedux: true,
    initialState: createMockState({ refreshFrequency: 0 }),
  });
  expect(screen.queryByTestId('auto-refresh-toggle')).not.toBeInTheDocument();
});

test('renders pause button when not paused', () => {
  const onTogglePause = jest.fn();
  render(<AutoRefreshControls onTogglePause={onTogglePause} />, {
    useRedux: true,
    initialState: createMockState({
      refreshFrequency: 5,
      autoRefreshPaused: false,
    }),
  });

  const button = screen.getByTestId('auto-refresh-toggle');
  expect(button).toBeInTheDocument();
  expect(button).toHaveAttribute('aria-label', 'Pause auto-refresh');
});

test('renders play button when paused', () => {
  const onTogglePause = jest.fn();
  render(<AutoRefreshControls onTogglePause={onTogglePause} />, {
    useRedux: true,
    initialState: createMockState({
      refreshFrequency: 5,
      autoRefreshPaused: true,
    }),
  });

  const button = screen.getByTestId('auto-refresh-toggle');
  expect(button).toHaveAttribute('aria-label', 'Resume auto-refresh');
});

test('calls onTogglePause when clicked', () => {
  const onTogglePause = jest.fn();
  render(<AutoRefreshControls onTogglePause={onTogglePause} />, {
    useRedux: true,
    initialState: createMockState({ refreshFrequency: 5 }),
  });

  fireEvent.click(screen.getByTestId('auto-refresh-toggle'));
  expect(onTogglePause).toHaveBeenCalledTimes(1);
});

test('is disabled when isLoading is true', () => {
  const onTogglePause = jest.fn();
  render(<AutoRefreshControls onTogglePause={onTogglePause} isLoading />, {
    useRedux: true,
    initialState: createMockState({ refreshFrequency: 5 }),
  });

  const button = screen.getByTestId('auto-refresh-toggle');
  expect(button).toBeDisabled();
});

test('is not disabled when isLoading is false', () => {
  const onTogglePause = jest.fn();
  render(
    <AutoRefreshControls onTogglePause={onTogglePause} isLoading={false} />,
    {
      useRedux: true,
      initialState: createMockState({ refreshFrequency: 5 }),
    },
  );

  const button = screen.getByTestId('auto-refresh-toggle');
  expect(button).not.toBeDisabled();
});

test('renders refresh button', () => {
  const onTogglePause = jest.fn();
  const onRefresh = jest.fn();
  render(
    <AutoRefreshControls
      onTogglePause={onTogglePause}
      onRefresh={onRefresh}
      showRefreshButton
    />,
    {
      useRedux: true,
      initialState: createMockState({ refreshFrequency: 5 }),
    },
  );

  const refreshButton = screen.getByTestId('auto-refresh-refresh-button');
  expect(refreshButton).toBeInTheDocument();
});

test('calls onRefresh when refresh button clicked', () => {
  const onTogglePause = jest.fn();
  const onRefresh = jest.fn();
  render(
    <AutoRefreshControls
      onTogglePause={onTogglePause}
      onRefresh={onRefresh}
      showRefreshButton
    />,
    {
      useRedux: true,
      initialState: createMockState({ refreshFrequency: 5 }),
    },
  );

  fireEvent.click(screen.getByTestId('auto-refresh-refresh-button'));
  expect(onRefresh).toHaveBeenCalledTimes(1);
});
