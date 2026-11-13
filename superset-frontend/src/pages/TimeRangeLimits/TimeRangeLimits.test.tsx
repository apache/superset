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
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { supersetTheme } from '@apache-superset/core/theme';
import TimeRangeLimits from './index';

const endpoint = 'glob:*/api/v1/time_range_limits/';
const loadError =
  'Time range limits could not be loaded. Queries are paused to protect the database.';

const payload = {
  schema_version: 1,
  revision: 0,
  policy: {
    max_span: { quantity: 12, time_grain: 'P1W' },
    max_look_back: { quantity: 0, time_grain: 'P1D' },
    max_look_forward: null,
  },
  display_labels: {
    max_span: '12 weeks',
    max_look_back: '0 days',
    max_look_forward: null,
  },
  eligible_time_grains: [{ value: 'P1W', label: 'Week' }],
};

const noRules = {
  ...payload,
  policy: { max_span: null, max_look_back: null, max_look_forward: null },
  display_labels: {
    max_span: null,
    max_look_back: null,
    max_look_forward: null,
  },
};

const unavailable = (extra: Record<string, string> = {}) => ({
  status: 503,
  body: {
    errors: [
      {
        message: 'The time range limits are not valid.',
        error_type: 'GENERIC_BACKEND_ERROR',
        level: 'error',
        extra,
      },
    ],
  },
});

function deferred() {
  let resolve: (value: unknown) => void = () => {};
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
}

const calls = () => fetchMock.callHistory.calls(endpoint).length;
const region = () => screen.getByRole('region', { name: 'Time range limits' });
const retryButton = () => screen.getByRole('button', { name: /Retry/ });

beforeEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  jest.useRealTimers();
});

test('marks the region busy while loading, and not after', async () => {
  const response = deferred();
  fetchMock.get(endpoint, () => response.promise);
  render(<TimeRangeLimits />);

  expect(region()).toHaveAttribute('aria-busy', 'true');
  await act(async () => {
    response.resolve({ result: payload });
  });
  await screen.findByText('12 weeks');
  expect(region()).not.toHaveAttribute('aria-busy');
});

test('shows the values inside the labelled region', async () => {
  fetchMock.get(endpoint, { result: payload });
  render(<TimeRangeLimits />);

  const content = within(region());
  expect(await content.findByText('Longest range')).toBeInTheDocument();
  expect(content.getByText('12 weeks')).toBeInTheDocument();
  expect(content.getByText('Earliest start')).toBeInTheDocument();
  expect(content.getByText('Today')).toBeInTheDocument();
  expect(content.getByText('Latest end')).toBeInTheDocument();
  expect(content.getByText('No limit')).toBeInTheDocument();
  expect(content.getByText('Dashboard editors')).toBeInTheDocument();
  expect(
    content.getByText('Can make limits stricter, never looser'),
  ).toBeInTheDocument();
  expect(
    content.getByText(
      "Limits of a day or longer count whole calendar days, from midnight in the server's time zone.",
    ),
  ).toBeInTheDocument();
});

test('words the values as "… ago", "Today", "… from now"', async () => {
  fetchMock.get(endpoint, {
    result: {
      ...payload,
      policy: {
        max_span: { quantity: 1, time_grain: 'P1Y' },
        max_look_back: { quantity: 2, time_grain: 'P1Y' },
        max_look_forward: { quantity: 1, time_grain: 'P1W' },
      },
      display_labels: {
        max_span: '1 year',
        max_look_back: '2 years',
        max_look_forward: '1 week',
      },
    },
  });
  render(<TimeRangeLimits />);

  const content = within(region());
  expect(await content.findByText('1 year')).toBeInTheDocument();
  expect(content.getByText('2 years ago')).toBeInTheDocument();
  expect(content.getByText('1 week from now')).toBeInTheDocument();
});

test('shows a zero sub-day look-forward as "Now"', async () => {
  fetchMock.get(endpoint, {
    result: {
      ...payload,
      policy: {
        ...payload.policy,
        max_look_forward: { quantity: 0, time_grain: 'PT1H' },
      },
      display_labels: {
        ...payload.display_labels,
        max_look_forward: '0 hours',
      },
    },
  });
  render(<TimeRangeLimits />);

  const content = within(region());
  await content.findByText('12 weeks');
  expect(content.getByText('Today')).toBeInTheDocument();
  expect(content.getByText('Now')).toBeInTheDocument();
});

test('puts the region in the User info panel style, with no colons', async () => {
  fetchMock.get(endpoint, { result: payload });
  render(<TimeRangeLimits />);

  await screen.findByText('12 weeks');
  expect(region()).toHaveStyleRule('margin', '0 12px 24px');
  expect(region()).toHaveStyleRule('padding', '16px');
  expect(region()).toHaveStyleRule(
    'background-color',
    supersetTheme.colorBgContainer,
  );
  const labels = region().querySelectorAll('.ant-descriptions-item-label');
  expect(labels).toHaveLength(4);
  labels.forEach(label =>
    expect(label).toHaveClass('ant-descriptions-item-no-colon'),
  );
});

test('shows the loading state inside the panel', async () => {
  const response = deferred();
  fetchMock.get(endpoint, () => response.promise);
  render(<TimeRangeLimits />);

  const spinner = within(region()).getByRole('status');
  expect(spinner).toHaveClass('inline-centered');
  await act(async () => {
    response.resolve({ result: payload });
  });
  await screen.findByText('12 weeks');
});

test('shows the switch label in bold with the helper under it', async () => {
  fetchMock.get(endpoint, { result: payload });
  render(<TimeRangeLimits />);

  const toggle = await screen.findByRole('switch', {
    name: 'Limit time ranges on all dashboards',
  });
  const label = screen.getByText('Limit time ranges on all dashboards');
  const helper = screen.getByText(
    'Set in the deployment configuration. Changing it needs a restart.',
  );
  expect(label.tagName).toBe('STRONG');
  const textColumn = label.closest('.ant-flex-vertical');
  expect(textColumn).toContainElement(helper);
  expect(textColumn).not.toContainElement(toggle);
});

test('shows a disabled switch with its label and helper, on when a rule is set', async () => {
  fetchMock.get(endpoint, { result: payload });
  render(<TimeRangeLimits />);

  const toggle = await screen.findByRole('switch', {
    name: 'Limit time ranges on all dashboards',
  });
  expect(toggle).toBeDisabled();
  expect(toggle).toBeChecked();
  expect(toggle).toHaveAccessibleDescription(
    'Set in the deployment configuration. Changing it needs a restart.',
  );
});

test('shows the switch off and every rule as "No limit" when none is set', async () => {
  fetchMock.get(endpoint, { result: noRules });
  render(<TimeRangeLimits />);

  const toggle = await screen.findByRole('switch', {
    name: 'Limit time ranges on all dashboards',
  });
  expect(toggle).not.toBeChecked();
  expect(screen.getAllByText('No limit')).toHaveLength(3);
});

test('shows a line when no time grains are eligible', async () => {
  fetchMock.get(endpoint, {
    result: { ...payload, eligible_time_grains: [] },
  });
  render(<TimeRangeLimits />);

  expect(
    await screen.findByText('No eligible time grains configured'),
  ).toBeInTheDocument();
});

test('does not show the eligible line when time grains are eligible', async () => {
  fetchMock.get(endpoint, { result: payload });
  render(<TimeRangeLimits />);

  await screen.findByText('12 weeks');
  expect(
    screen.queryByText('No eligible time grains configured'),
  ).not.toBeInTheDocument();
});

test('sends exactly one request on mount when it gets a 503', async () => {
  fetchMock.get(endpoint, unavailable());
  render(<TimeRangeLimits />);

  await screen.findByText(loadError);
  await act(async () => {
    await new Promise(done => setTimeout(done, 50));
  });
  expect(calls()).toBe(1);
});

test('shows the load error with Retry and no close button on a 503', async () => {
  fetchMock.get(endpoint, unavailable());
  render(<TimeRangeLimits />);

  const alert = await screen.findByRole('alert');
  expect(within(region()).getByRole('alert')).toBe(alert);
  expect(alert).toHaveTextContent(loadError);
  expect(within(alert).getByRole('button', { name: /Retry/ })).toBeVisible();
  expect(
    within(alert).queryByRole('button', { name: /close/i }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Longest range')).not.toBeInTheDocument();
});

test('shows the load error with Retry on a 500', async () => {
  fetchMock.get(endpoint, { status: 500, body: { message: 'boom' } });
  render(<TimeRangeLimits />);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(loadError);
  expect(within(alert).getByRole('button', { name: /Retry/ })).toBeVisible();
});

test('shows the unit sentence when a time grain is no longer available', async () => {
  fetchMock.get(
    endpoint,
    unavailable({ field: 'max_span.time_grain', value: 'P1W' }),
  );
  render(<TimeRangeLimits />);

  expect(
    await screen.findByText(
      'Configured time grain P1W is no longer available. Select a supported unit.',
    ),
  ).toBeInTheDocument();
});

test('shows no unit sentence when the time grain has no value', async () => {
  fetchMock.get(endpoint, unavailable({ field: 'max_span.time_grain' }));
  render(<TimeRangeLimits />);

  await screen.findByText(loadError);
  expect(screen.queryByText(/Configured time grain/)).not.toBeInTheDocument();
});

test('shows no unit sentence for another field', async () => {
  fetchMock.get(endpoint, unavailable({ field: 'schema_version' }));
  render(<TimeRangeLimits />);

  await screen.findByText(loadError);
  expect(screen.queryByText(/is no longer available/)).not.toBeInTheDocument();
});

test('shows the load error after a 10 second timeout', async () => {
  jest.useFakeTimers();
  fetchMock.get(endpoint, () => new Promise(() => {}));
  render(<TimeRangeLimits />);

  await act(async () => {});
  expect(calls()).toBe(1);
  await act(async () => {
    jest.advanceTimersByTime(9999);
  });
  expect(screen.queryByText(loadError)).not.toBeInTheDocument();
  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(await screen.findByText(loadError)).toBeInTheDocument();
  expect(calls()).toBe(1);
});

test('sends exactly one new request per Retry click', async () => {
  fetchMock.get(endpoint, unavailable());
  render(<TimeRangeLimits />);

  await screen.findByText(loadError);
  expect(calls()).toBe(1);
  await userEvent.click(retryButton());
  await waitFor(() => expect(calls()).toBe(2));
  await waitFor(() => expect(retryButton()).not.toHaveClass('ant-btn-loading'));
  await act(async () => {
    await new Promise(done => setTimeout(done, 50));
  });
  expect(calls()).toBe(2);
});

test('ignores a second click while pending and keeps focus on Retry', async () => {
  fetchMock.get(endpoint, unavailable(), { repeat: 1 });
  render(<TimeRangeLimits />);
  await screen.findByText(loadError);

  const response = deferred();
  fetchMock.get(endpoint, () => response.promise);
  const button = retryButton();
  button.focus();
  await userEvent.click(button);
  await waitFor(() => expect(calls()).toBe(2));
  await waitFor(() => expect(button).toHaveClass('ant-btn-loading'));

  await userEvent.click(button);
  expect(calls()).toBe(2);
  expect(document.activeElement).toBe(button);
  expect(region()).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('alert')).toHaveTextContent(loadError);

  await act(async () => {
    response.resolve({ result: payload });
  });
  await screen.findByText('12 weeks');
});

test('re-renders the alert on a second failure and focuses the new Retry', async () => {
  fetchMock.get(endpoint, unavailable());
  render(<TimeRangeLimits />);

  const firstAlert = await screen.findByRole('alert');
  expect(document.activeElement).toBe(document.body);
  const firstRetry = retryButton();
  firstRetry.focus();
  await userEvent.click(firstRetry);

  await waitFor(() => expect(screen.getByRole('alert')).not.toBe(firstAlert));
  const secondAlert = screen.getByRole('alert');
  expect(firstAlert).not.toBeInTheDocument();
  expect(secondAlert).toHaveTextContent(loadError);
  const secondRetry = within(secondAlert).getByRole('button', {
    name: /Retry/,
  });
  expect(secondRetry).not.toBe(firstRetry);
  expect(document.activeElement).toBe(secondRetry);
});

test('moves focus to the region after a successful Retry', async () => {
  fetchMock.get(endpoint, unavailable(), { repeat: 1 });
  render(<TimeRangeLimits />);
  await screen.findByText(loadError);

  fetchMock.get(endpoint, { result: payload });
  await userEvent.click(retryButton());

  await screen.findByText('12 weeks');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(document.activeElement).toBe(region());
});

test('does not move focus after the first load', async () => {
  fetchMock.get(endpoint, { result: payload });
  render(<TimeRangeLimits />);

  await screen.findByText('12 weeks');
  expect(document.activeElement).toBe(document.body);
});

test('a11y: the page title is a level 1 heading', async () => {
  fetchMock.get(endpoint, { result: payload });
  render(<TimeRangeLimits />);

  expect(
    screen.getByRole('heading', { level: 1, name: 'Time range limits' }),
  ).toBeInTheDocument();
  await screen.findByText('12 weeks');
});

test('a11y: the load error hides its icon and keeps the antd default look', async () => {
  fetchMock.get(
    endpoint,
    unavailable({ field: 'max_span.time_grain', value: 'P1Q' }),
  );
  render(<TimeRangeLimits />);

  const alertIcon = () =>
    screen
      .getByRole('alert')
      // eslint-disable-next-line testing-library/no-node-access
      .querySelector('.ant-alert-icon > .anticon') as HTMLElement;

  await screen.findByRole('alert');
  const icon = alertIcon();
  expect(icon).toHaveAttribute('aria-hidden', 'true');
  expect(icon).toHaveClass('anticon-close-circle');
  expect(icon).not.toHaveAttribute('style');

  fetchMock.removeRoutes().get(endpoint, unavailable());
  await userEvent.click(retryButton());
  await waitFor(() =>
    expect(
      screen.queryByText(/is no longer available/),
    ).not.toBeInTheDocument(),
  );
  const plainIcon = alertIcon();
  expect(plainIcon).toHaveAttribute('aria-hidden', 'true');
  expect(plainIcon).not.toHaveAttribute('style');
});
