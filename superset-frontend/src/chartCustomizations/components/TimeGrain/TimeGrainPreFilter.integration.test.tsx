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
 * Integration Test: Time Grain Pre-filter Feature (Customization plugin)
 *
 * Mirrors src/filters/components/TimeGrain/TimeGrainPreFilter.integration.test.tsx
 * but targets the customization plugin at
 * src/chartCustomizations/components/TimeGrain/TimeGrainFilterPlugin and adds
 * a case for the escape hatch the customization version introduces.
 */

import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import PluginFilterTimegrain from 'src/chartCustomizations/components/TimeGrain/TimeGrainFilterPlugin';
import type { PluginFilterTimeGrainProps } from 'src/chartCustomizations/components/TimeGrain/types';

const data = [
  { duration: 'PT1M', name: 'Minute' },
  { duration: 'PT1H', name: 'Hour' },
  { duration: 'P1D', name: 'Day' },
  { duration: 'P1W', name: 'Week' },
  { duration: 'P1M', name: 'Month' },
];

const baseConfig = {
  height: 100,
  width: 300,
  setFilterActive: jest.fn(),
  setHoveredFilter: jest.fn(),
  unsetHoveredFilter: jest.fn(),
  setFocusedFilter: jest.fn(),
  unsetFocusedFilter: jest.fn(),
  inputRef: { current: null },
};

/**
 * Scenario: Dashboard editor configures a time grain filter to show only Hour, Day, Week.
 * End-user opens the dashboard and can only select from those three options.
 */
test('time grain pre-filter restricts dashboard filter options', async () => {
  const setDataMask = jest.fn();
  const dashboardConfig: PluginFilterTimeGrainProps = {
    ...baseConfig,
    data,
    formData: {
      datasource: '3__table',
      height: 100,
      width: 300,
      nativeFilterId: 'time_grain_1',
      defaultValue: null,
      viz_type: 'filter_timegrain',
      timeGrains: ['PT1H', 'P1D', 'P1W'],
    },
    filterState: {
      value: null,
      validateStatus: undefined,
      validateMessage: undefined,
    },
    setDataMask,
  };

  render(<PluginFilterTimegrain {...dashboardConfig} />);

  expect(screen.getByText('3 options')).toBeInTheDocument();

  setDataMask.mockClear();

  await userEvent.click(screen.getByRole('combobox'));

  await waitFor(() => {
    const labels = screen.getAllByRole('option').map(o => o.textContent);
    expect(labels).toEqual(['Hour', 'Day', 'Week']);
    expect(labels).not.toContain('Minute');
    expect(labels).not.toContain('Month');
  });

  await userEvent.click(screen.getByText('Day'));

  await waitFor(() => {
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: { time_grain_sqla: 'P1D' },
      filterState: { label: 'Day', value: ['P1D'] },
    });
  });
});

/**
 * Scenario: Dashboard editor disables pre-filter (unchecks the CollapsibleControl).
 * No restrictions: all time grains appear in the runtime filter.
 */
test('all time grains appear when pre-filter is unchecked', async () => {
  const dashboardConfig: PluginFilterTimeGrainProps = {
    ...baseConfig,
    data,
    formData: {
      datasource: '3__table',
      height: 100,
      width: 300,
      nativeFilterId: 'time_grain_1',
      defaultValue: null,
      viz_type: 'filter_timegrain',
      timeGrains: undefined,
    },
    filterState: {
      value: null,
      validateStatus: undefined,
      validateMessage: undefined,
    },
    setDataMask: jest.fn(),
  };

  render(<PluginFilterTimegrain {...dashboardConfig} />);

  await userEvent.click(screen.getByRole('combobox'));

  await waitFor(() => {
    const labels = screen.getAllByRole('option').map(o => o.textContent);
    expect(labels).toEqual(['Minute', 'Hour', 'Day', 'Week', 'Month']);
  });
});

/**
 * Scenario: Dashboard editor narrowed the pre-filter after an end-user had
 * already selected a value that now falls outside the allowlist.
 * The current selection stays visible so the filter does not silently drop it.
 */
test('current selection stays visible when it is outside the pre-filter allowlist', async () => {
  const dashboardConfig: PluginFilterTimeGrainProps = {
    ...baseConfig,
    data,
    formData: {
      datasource: '3__table',
      height: 100,
      width: 300,
      nativeFilterId: 'time_grain_1',
      defaultValue: null,
      viz_type: 'filter_timegrain',
      timeGrains: ['PT1H', 'P1D', 'P1W'],
    },
    filterState: {
      value: ['P1M'],
      validateStatus: undefined,
      validateMessage: undefined,
    },
    setDataMask: jest.fn(),
  };

  render(<PluginFilterTimegrain {...dashboardConfig} />);

  await userEvent.click(screen.getByRole('combobox'));

  await waitFor(() => {
    const labels = screen.getAllByRole('option').map(o => o.textContent);
    expect(labels).toHaveLength(4);
    expect(labels).toEqual(
      expect.arrayContaining(['Hour', 'Day', 'Week', 'Month']),
    );
    expect(labels).not.toContain('Minute');
  });
});
