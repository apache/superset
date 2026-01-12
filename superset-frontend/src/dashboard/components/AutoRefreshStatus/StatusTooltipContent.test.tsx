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

test('renders success status tooltip with timestamp and interval', () => {
  const now = Date.now();
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Success}
      lastSuccessfulRefresh={now - 5000}
      lastError={null}
      refreshFrequency={10}
      autoRefreshFetchStartTime={null}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
  // Should contain info about the refresh interval
  expect(container.textContent).toContain('10');
});

test('renders fetching status tooltip', () => {
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Fetching}
      lastSuccessfulRefresh={Date.now() - 5000}
      lastError={null}
      refreshFrequency={10}
      autoRefreshFetchStartTime={Date.now()}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
});

test('renders paused status tooltip', () => {
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Paused}
      lastSuccessfulRefresh={Date.now() - 5000}
      lastError={null}
      refreshFrequency={10}
      autoRefreshFetchStartTime={null}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
});

test('renders error status with error message', () => {
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Error}
      lastSuccessfulRefresh={Date.now() - 30000}
      lastError="Network timeout"
      refreshFrequency={10}
      autoRefreshFetchStartTime={null}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
  expect(container.textContent).toContain('Network timeout');
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
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
});

test('handles null lastSuccessfulRefresh gracefully', () => {
  render(
    <StatusTooltipContent
      status={AutoRefreshStatus.Idle}
      lastSuccessfulRefresh={null}
      lastError={null}
      refreshFrequency={10}
      autoRefreshFetchStartTime={null}
    />,
  );

  const container = screen.getByTestId('status-tooltip-content');
  expect(container).toBeInTheDocument();
});
