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
import { ComponentProps } from 'react';
import {
  render,
  screen,
  userEvent,
  within,
} from 'spec/helpers/testing-library';
import RefreshIntervalModal from 'src/dashboard/components/RefreshIntervalModal';

const defaultProps = {
  show: true,
  onHide: jest.fn(),
  refreshFrequency: 60,
  onChange: jest.fn(),
  editMode: true,
  addSuccessToast: jest.fn(),
  pauseOnInactiveTab: false,
  onPauseOnInactiveTabChange: jest.fn(),
};

const setup = (
  props: Partial<ComponentProps<typeof RefreshIntervalModal>> = {},
  refreshLimitConf: Record<string, unknown> = {},
) =>
  render(<RefreshIntervalModal {...defaultProps} {...props} />, {
    useRedux: true,
    initialState: {
      dashboardInfo: { common: { conf: refreshLimitConf } },
    },
  });

beforeEach(() => {
  jest.clearAllMocks();
});

test('selecting an interval and saving persists it in edit mode', async () => {
  setup();

  await userEvent.click(screen.getByRole('radio', { name: '5 minutes' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(defaultProps.onChange).toHaveBeenCalledWith(300, true);
  expect(defaultProps.onPauseOnInactiveTabChange).toHaveBeenCalledWith(false);
  expect(defaultProps.onHide).toHaveBeenCalledTimes(1);
  expect(defaultProps.addSuccessToast).toHaveBeenCalledWith(
    'Refresh interval saved',
  );
});

test('saving outside edit mode reports a session-only save', async () => {
  setup({ editMode: false });

  await userEvent.click(
    screen.getByRole('button', { name: 'Save for this session' }),
  );

  expect(defaultProps.onChange).toHaveBeenCalledWith(60, false);
  expect(defaultProps.addSuccessToast).toHaveBeenCalledWith(
    'Refresh interval set for this session',
  );
});

test('an interval below the configured limit blocks save with an error', async () => {
  setup({}, { SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT: 60 });

  await userEvent.click(screen.getByRole('radio', { name: '10 seconds' }));

  expect(
    screen.getByText('Refresh frequency must be at least 60 seconds'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(defaultProps.onChange).not.toHaveBeenCalled();
});

test('an interval below the limit shows the configured warning alongside the error', async () => {
  setup(
    {},
    {
      SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT: 60,
      SUPERSET_DASHBOARD_PERIODICAL_REFRESH_WARNING_MESSAGE:
        'Frequent refreshes put load on the database',
    },
  );

  await userEvent.click(screen.getByRole('radio', { name: '10 seconds' }));

  expect(
    screen.getByText('Refresh frequency must be at least 60 seconds'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Frequent refreshes put load on the database'),
  ).toBeInTheDocument();
});

test('the configured warning is hidden when the interval meets the limit', async () => {
  setup(
    {},
    {
      SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT: 60,
      SUPERSET_DASHBOARD_PERIODICAL_REFRESH_WARNING_MESSAGE:
        'Frequent refreshes put load on the database',
    },
  );

  await userEvent.click(screen.getByRole('radio', { name: '5 minutes' }));

  expect(
    screen.queryByText('Frequent refreshes put load on the database'),
  ).not.toBeInTheDocument();
});

test('an interval at or above the configured limit does not block save', async () => {
  setup({}, { SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT: 60 });

  await userEvent.click(screen.getByRole('radio', { name: '5 minutes' }));

  expect(
    screen.queryByText(/Refresh frequency must be at least/),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('cancel resets the selection back to the original frequency and does not save', async () => {
  // defaultProps.refreshFrequency (60) maps to the "1 minute" preset.
  setup();
  expect(screen.getByRole('radio', { name: '1 minute' })).toBeChecked();

  await userEvent.click(screen.getByRole('radio', { name: '1 hour' }));
  expect(screen.getByRole('radio', { name: '1 hour' })).toBeChecked();

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(defaultProps.onChange).not.toHaveBeenCalled();
  expect(defaultProps.onHide).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('radio', { name: '1 minute' })).toBeChecked();
  expect(screen.getByRole('radio', { name: '1 hour' })).not.toBeChecked();
});

test('the interval list comes from the configured DASHBOARD_AUTO_REFRESH_INTERVALS', async () => {
  setup(
    {},
    {
      DASHBOARD_AUTO_REFRESH_INTERVALS: [
        [0, "Don't refresh"],
        [600, '10 minutes'],
        [3600, '1 hour'],
      ],
    },
  );

  expect(screen.getByRole('radio', { name: '10 minutes' })).toBeInTheDocument();
  expect(
    screen.queryByRole('radio', { name: '10 seconds' }),
  ).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('radio', { name: '10 minutes' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(defaultProps.onChange).toHaveBeenCalledWith(600, true);
});

test('a saved frequency missing from the configured list still renders and survives a save', async () => {
  // defaultProps.refreshFrequency is 60, which the configuration below omits.
  setup(
    {},
    {
      DASHBOARD_AUTO_REFRESH_INTERVALS: [
        [0, "Don't refresh"],
        [3600, '1 hour'],
      ],
    },
  );

  expect(screen.getByRole('radio', { name: '1 hour' })).toBeInTheDocument();
  expect(screen.getByRole('spinbutton')).toHaveValue(60);

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(defaultProps.onChange).toHaveBeenCalledWith(60, true);
});

const POLICY_OPTIONS = [
  { value: 0, label: "Don't refresh" },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
];
const SESSION_HELP = 'Set refresh frequency for current session only.';

const setupWithPolicy = (
  options: { value: number; label: string }[],
  policy: Record<string, unknown>,
) => setup({ editMode: false, refreshFrequency: 0, options, policy });

test('with a policy only the allowed intervals are offered, without Custom', () => {
  setupWithPolicy(POLICY_OPTIONS, {
    minimum_refresh_interval: { value: 30, unit: 'seconds' },
    maximum_refresh_interval: { value: 1, unit: 'hours' },
  });

  expect(
    screen
      .getAllByRole('radio')
      .map(radio => radio.closest('label')?.textContent),
  ).toEqual(POLICY_OPTIONS.map(({ label }) => label));
  expect(
    screen.queryByRole('radio', { name: /Custom/ }),
  ).not.toBeInTheDocument();
});

test.each([
  [
    '1: no interval left',
    [{ value: 0, label: "Don't refresh" }],
    {
      minimum_refresh_interval: { value: 1, unit: 'hours' },
      maximum_refresh_interval: { value: 5, unit: 'minutes' },
    },
    SESSION_HELP,
  ],
  [
    '2: exactly one interval',
    POLICY_OPTIONS.filter(({ value }) => value === 0 || value === 60),
    {
      minimum_refresh_interval: { value: 1, unit: 'minutes' },
      maximum_refresh_interval: { value: 1, unit: 'minutes' },
    },
    `${SESSION_HELP} This dashboard allows 1 minute.`,
  ],
  [
    '3: minimum and maximum',
    POLICY_OPTIONS,
    {
      minimum_refresh_interval: { value: 30, unit: 'seconds' },
      maximum_refresh_interval: { value: 1, unit: 'hours' },
    },
    `${SESSION_HELP} This dashboard allows 30 seconds to 1 hour.`,
  ],
  [
    '4: only a minimum',
    POLICY_OPTIONS.filter(({ value }) => value === 0 || value >= 300),
    { minimum_refresh_interval: { value: 5, unit: 'minutes' } },
    `${SESSION_HELP} This dashboard allows 5 minutes or longer.`,
  ],
  [
    '5: only a maximum',
    POLICY_OPTIONS.filter(({ value }) => value <= 300),
    { maximum_refresh_interval: { value: 5, unit: 'minutes' } },
    `${SESSION_HELP} This dashboard allows up to 5 minutes.`,
  ],
  [
    '6: no bounds',
    POLICY_OPTIONS,
    { auto_refresh_allowed: true },
    SESSION_HELP,
  ],
  [
    '6: a malformed bound counts as not set',
    POLICY_OPTIONS,
    { minimum_refresh_interval: { value: '30', unit: 'seconds' } },
    SESSION_HELP,
  ],
])('help text rule %s', (_, options, policy, help) => {
  setupWithPolicy(options, policy);

  expect(screen.getByText(help, { exact: true })).toBeInTheDocument();
});

test('without a policy the existing list with Custom is shown', () => {
  setup({ editMode: false });

  expect(screen.getByRole('radio', { name: /Custom/ })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '10 seconds' })).toBeInTheDocument();
  expect(screen.getByText(SESSION_HELP)).toBeInTheDocument();
});

test('with a policy the intervals are a named group described by the help text', () => {
  setupWithPolicy(POLICY_OPTIONS, {
    minimum_refresh_interval: { value: 30, unit: 'seconds' },
    maximum_refresh_interval: { value: 1, unit: 'hours' },
  });

  const group = screen.getByRole('radiogroup', { name: 'Refresh frequency' });
  expect(group).toHaveAccessibleDescription(
    `${SESSION_HELP} This dashboard allows 30 seconds to 1 hour.`,
  );
  expect(within(group).getAllByRole('radio')).toHaveLength(
    POLICY_OPTIONS.length,
  );
});

test('with a policy the limit error describes the group', () => {
  setup(
    {
      editMode: false,
      refreshFrequency: 60,
      options: POLICY_OPTIONS,
      policy: {},
    },
    { SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT: 300 },
  );

  expect(
    screen.getByRole('radiogroup', { name: 'Refresh frequency' }),
  ).toHaveAccessibleDescription(
    'Refresh frequency must be at least 300 seconds',
  );
});

test('without a policy the existing markup has no group and no help id', () => {
  const { container } = setup({ editMode: false });

  expect(
    screen.queryByRole('radiogroup', { name: 'Refresh frequency' }),
  ).not.toBeInTheDocument();
  expect(
    container.ownerDocument.getElementById('refresh-interval-help'),
  ).not.toBeInTheDocument();
  expect(
    container.ownerDocument.querySelector('[aria-describedby]'),
  ).not.toBeInTheDocument();
  expect(screen.getByText(SESSION_HELP).tagName).toBe('DIV');
});
