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
import { TimeRangeAdjustmentList } from '.';
import type { TimeRangeAdjustment } from './types';

const limit: TimeRangeAdjustment = {
  kind: 'time_range_limit',
  dashboard: 'Sales',
  dashboard_key: 'sales-uuid',
  file: null,
  name: 'Sales',
  filter_id: null,
  field: 'max_span',
  old: { quantity: 20, time_grain: 'P1W' },
  new: { quantity: 12, time_grain: 'P1W' },
  old_label: '20 weeks',
  new_label: '12 weeks',
};

const filterDefault: TimeRangeAdjustment = {
  kind: 'filter_default',
  dashboard: 'Sales',
  dashboard_key: 'sales-uuid',
  file: null,
  name: 'Date',
  filter_id: 'NATIVE_FILTER-date',
  field: 'default',
  old: null,
  new: 'DATEADD(DATETIME("today"), -14, day) : today',
  old_label: 'No filter',
  new_label: 'Last 14 days',
};

afterEach(() => {
  jest.restoreAllMocks();
});

test('lists each change in plain words', () => {
  render(<TimeRangeAdjustmentList adjustments={[limit, filterDefault]} />);

  const items = screen.getAllByRole('listitem');
  expect(items.map(item => item.textContent)).toEqual([
    'Time range limit "Maximum span": "20 weeks" → "12 weeks"',
    'Time range filter "Date": default "No filter" → "Last 14 days"',
  ]);
  expect(screen.queryByText('Dashboard "Sales"')).not.toBeInTheDocument();
});

test('names a change to the range a filter applies', () => {
  render(
    <TimeRangeAdjustmentList
      adjustments={[
        {
          ...filterDefault,
          field: 'applied_range',
          old: 'Last month',
          old_label: 'Last month',
        },
      ]}
    />,
  );

  expect(
    screen.getByText(
      'Time range filter "Date": applied range "Last month" → "Last 14 days"',
    ),
  ).toBeInTheDocument();
});

test('keeps dashboards with the same title apart and names their files', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  render(
    <TimeRangeAdjustmentList
      adjustments={[
        { ...filterDefault, dashboard_key: 'one', file: 'dashboards/a.yaml' },
        { ...filterDefault, dashboard_key: 'two', file: 'dashboards/b.yaml' },
      ]}
    />,
  );

  expect(
    screen.getByText('Dashboard "Sales" (dashboards/a.yaml)'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Dashboard "Sales" (dashboards/b.yaml)'),
  ).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(error).not.toHaveBeenCalled();
});

test('names the dashboard when asked, even for one, and an untitled one', () => {
  render(
    <TimeRangeAdjustmentList
      adjustments={[{ ...limit, dashboard: '', file: 'dashboards/x.yaml' }]}
      showDashboard
    />,
  );

  expect(
    screen.getByText('Dashboard "Untitled dashboard" (dashboards/x.yaml)'),
  ).toBeInTheDocument();
});

test('names every rule a limit change can touch', () => {
  render(
    <TimeRangeAdjustmentList
      adjustments={[
        { ...limit, field: 'max_look_back' },
        { ...limit, field: 'max_look_forward' },
      ]}
    />,
  );

  expect(
    screen.getByText(
      'Time range limit "Maximum look-back": "20 weeks" → "12 weeks"',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Time range limit "Maximum look-forward": "20 weeks" → "12 weeks"',
    ),
  ).toBeInTheDocument();
});
