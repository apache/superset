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
import { StatusTooltipContent } from './StatusTooltipContent';
import { AutoRefreshStatus } from '../../types/autoRefresh';

test('renders success status tooltip with precise seconds format', () => {
  const now = Date.now();
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Success}
      lastSuccessfulRefresh={now - 5000}
      lastError={null}
      refreshFrequency={10}
      autoRefreshFetchStartTime={null}
      currentTime={now}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
  // Should show precise seconds format "X s ago"
  expect(container).toHaveTextContent(/\d+ s ago/);
  // Should contain info about the refresh interval
  expect(container).toHaveTextContent('10');
});

test('renders minutes format for older timestamps', () => {
  const now = Date.now();
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Success}
      lastSuccessfulRefresh={now - 120000}
      lastError={null}
      refreshFrequency={10}
      autoRefreshFetchStartTime={null}
      currentTime={now}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
  // Should show minutes format "X min ago"
  expect(container).toHaveTextContent(/\d+ min ago/);
});

test('renders fetching status tooltip', () => {
  const now = Date.now();
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Fetching}
      lastSuccessfulRefresh={now - 5000}
      lastError={null}
      refreshFrequency={10}
      autoRefreshFetchStartTime={now}
      currentTime={now}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
});

test('renders paused status with last updated time and interval in parentheses', () => {
  const now = Date.now();
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Paused}
      lastSuccessfulRefresh={now - 5000}
      lastError={null}
      refreshFrequency={10}
      autoRefreshFetchStartTime={null}
      currentTime={now}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
  // Should show last updated time on first line
  expect(container).toHaveTextContent(/Dashboard updated \d+ s ago/);
  // Should show paused status with interval in parentheses
  expect(container).toHaveTextContent(
    'Auto refresh paused (set to 10 seconds)',
  );
});

test('renders error status with error message', () => {
  const now = Date.now();
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Error}
      lastSuccessfulRefresh={now - 30000}
      lastError="Network timeout"
      refreshFrequency={10}
      autoRefreshFetchStartTime={null}
      currentTime={now}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
  expect(container).toHaveTextContent('Network timeout');
});

test('renders delayed status with delay info', () => {
  const now = Date.now();
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Delayed}
      lastSuccessfulRefresh={now - 15000}
      lastError={null}
      refreshFrequency={10}
      autoRefreshFetchStartTime={now - 8000}
      currentTime={now}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
});

test('shows waiting message when no refresh has occurred yet', () => {
  const now = Date.now();
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Idle}
      lastSuccessfulRefresh={null}
      lastError={null}
      refreshFrequency={10}
      autoRefreshFetchStartTime={null}
      currentTime={now}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
  expect(container).toHaveTextContent('Waiting for first refresh');
});
