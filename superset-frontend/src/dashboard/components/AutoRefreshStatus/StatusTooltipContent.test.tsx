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
      lastAutoRefreshTime={now - 5000}
      refreshErrorCount={0}
      refreshFrequency={10}
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
      lastAutoRefreshTime={now - 120000}
      refreshErrorCount={0}
      refreshFrequency={10}
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
      lastAutoRefreshTime={now - 5000}
      refreshErrorCount={0}
      refreshFrequency={10}
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
      lastAutoRefreshTime={now - 5000}
      refreshErrorCount={0}
      refreshFrequency={10}
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

test('renders error status copy with last updated line', () => {
  const now = Date.now();
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Error}
      lastSuccessfulRefresh={now - 30000}
      lastAutoRefreshTime={now - 1000}
      refreshErrorCount={2}
      refreshFrequency={10}
      currentTime={now}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
  expect(container).toHaveTextContent(
    'There was a problem refreshing your dashboard.',
  );
  expect(container).toHaveTextContent('Last updated');
  expect(container).not.toHaveTextContent('Network timeout');
});

test('omits last updated line when there was no successful refresh', () => {
  const now = Date.now();
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Error}
      lastSuccessfulRefresh={null}
      lastAutoRefreshTime={now - 1000}
      refreshErrorCount={2}
      refreshFrequency={10}
      currentTime={now}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
  expect(container).toHaveTextContent(
    'There was a problem refreshing your dashboard.',
  );
  expect(container).not.toHaveTextContent('Last updated');
});

test('renders delayed status with missed refresh description', () => {
  const now = Date.now();
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Delayed}
      lastSuccessfulRefresh={now - 7000}
      lastAutoRefreshTime={now - 7000}
      refreshErrorCount={1}
      refreshFrequency={3}
      currentTime={now}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
  expect(container).toHaveTextContent('Delayed (missed 1 refresh)');
});

test('shows waiting message when no refresh has occurred yet', () => {
  const now = Date.now();
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Idle}
      lastSuccessfulRefresh={null}
      lastAutoRefreshTime={null}
      refreshErrorCount={0}
      refreshFrequency={10}
      currentTime={now}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
  expect(container).toHaveTextContent('Waiting for first refresh');
});
