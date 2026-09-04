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

/**
 * Integration Test: Time Grain Pre-filter Feature (End-to-End)
 *
 * Tests the full flow:
 * 1. Dashboard config: User enables pre-filter and selects allowed time grains
 * 2. Dashboard persistence: Config is saved with time_grains array
 * 3. Runtime filter: Dashboard displays only the pre-filtered time grains
 *
 * Note: This documents the expected behavior. Full E2E testing requires
 * Playwright/browser tests since it involves dashboard state + filter interactions.
 */

import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import PluginFilterTimegrain from 'src/filters/components/TimeGrain/TimeGrainFilterPlugin';

/**
 * Scenario: Dashboard owner configures a time grain filter to show only Hour, Day, Week.
 * End-user opens the dashboard and can only select from those three options.
 */
test('time grain pre-filter restricts dashboard filter options', async () => {
  // Step 1: Simulate saved dashboard config
  // (User previously set pre-filter to ['PT1H', 'P1D', 'P1W'])
  const setDataMask = jest.fn();
  const dashboardConfig = {
    data: [
      { duration: 'PT1M', name: 'Minute' },
      { duration: 'PT1H', name: 'Hour' },
      { duration: 'P1D', name: 'Day' },
      { duration: 'P1W', name: 'Week' },
      { duration: 'P1M', name: 'Month' },
    ],
    formData: {
      nativeFilterId: 'time_grain_1',
      defaultValue: null,
      viz_type: 'filter_timegrain',
      // This is what was saved by the config form:
      time_grains: ['PT1H', 'P1D', 'P1W'],
    },
    filterState: {
      value: null,
      validateStatus: undefined,
      validateMessage: undefined,
    },
    height: 100,
    width: 300,
    setDataMask,
    setFilterActive: jest.fn(),
    setHoveredFilter: jest.fn(),
    unsetHoveredFilter: jest.fn(),
    setFocusedFilter: jest.fn(),
    unsetFocusedFilter: jest.fn(),
    inputRef: { current: null },
  };

  // Step 2: Render the dashboard filter
  render(<PluginFilterTimegrain {...(dashboardConfig as any)} />);

  // Ignore initialization updates and validate the explicit user-selection payload.
  setDataMask.mockClear();

  // Step 3: Verify only pre-filtered options appear
  const select = screen.getByRole('combobox');
  await userEvent.click(select);

  await waitFor(() => {
    const options = screen.getAllByRole('option');
    const labels = options.map(o => o.textContent);

    // Should only show Hour, Day, Week (in database order)
    expect(labels).toEqual(['Hour', 'Day', 'Week']);

    // Should NOT show Minute or Month
    expect(labels).not.toContain('Minute');
    expect(labels).not.toContain('Month');
  });

  // Step 4: Selecting one allowed option should update runtime payload
  await userEvent.click(screen.getByText('Day'));

  await waitFor(() => {
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {
        time_grain_sqla: 'P1D',
      },
      filterState: {
        label: 'Day',
        value: ['P1D'],
      },
    });
  });
});

/**
 * Scenario: Dashboard owner disables pre-filter (unchecks the CollapsibleControl).
 * No restrictions: all time grains appear in the runtime filter.
 */
test('all time grains appear when pre-filter is unchecked', async () => {
  const dashboardConfig = {
    data: [
      { duration: 'PT1M', name: 'Minute' },
      { duration: 'PT1H', name: 'Hour' },
      { duration: 'P1D', name: 'Day' },
      { duration: 'P1W', name: 'Week' },
      { duration: 'P1M', name: 'Month' },
    ],
    formData: {
      nativeFilterId: 'time_grain_1',
      defaultValue: null,
      viz_type: 'filter_timegrain',
      // Pre-filter not set (checkbox unchecked in config)
      time_grains: undefined,
    },
    filterState: {
      value: null,
      validateStatus: undefined,
      validateMessage: undefined,
    },
    height: 100,
    width: 300,
    setDataMask: jest.fn(),
    setFilterActive: jest.fn(),
    setHoveredFilter: jest.fn(),
    unsetHoveredFilter: jest.fn(),
    setFocusedFilter: jest.fn(),
    unsetFocusedFilter: jest.fn(),
    inputRef: { current: null },
  };

  render(<PluginFilterTimegrain {...(dashboardConfig as any)} />);

  const select = screen.getByRole('combobox');
  await userEvent.click(select);

  await waitFor(() => {
    const options = screen.getAllByRole('option');
    const labels = options.map(o => o.textContent);

    // All 5 options should be available
    expect(labels).toEqual(['Minute', 'Hour', 'Day', 'Week', 'Month']);
  });
});
