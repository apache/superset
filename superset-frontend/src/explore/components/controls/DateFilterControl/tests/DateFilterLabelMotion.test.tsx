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
import thunk from 'redux-thunk';
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import rison from 'rison';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import DateFilterLabel from '..';
import { DateFilterTestKey } from '../utils';

// jsdom has no transition events, so antd skips its leave animation. Turn it
// on: the popover content then stays in the page for a while after closing.
jest.mock('@rc-component/motion/lib/util/motion', () => ({
  ...jest.requireActual('@rc-component/motion/lib/util/motion'),
  supportTransition: true,
}));

const SERVER: Record<string, [string, string]> = {
  'today : now': ['2025-05-31T00:00:00', '2025-05-31T14:30:00'],
  'Last week': ['2025-05-24T00:00:00', '2025-05-31T00:00:00'],
  'Last month': ['2025-04-30T00:00:00', '2025-05-31T00:00:00'],
};

beforeAll(() => fetchMock.mockGlobal());
afterAll(() => fetchMock.hardReset());
beforeEach(() => {
  fetchMock.get('glob:*/api/v1/time_range/*', ({ url }: { url: string }) => {
    const items: { timeRange: string }[] = rison.decode(
      new URL(url).searchParams.get('q')!,
    );
    return {
      result: items.map(({ timeRange }) => ({
        since: SERVER[timeRange]?.[0] ?? '2025-05-30T00:00:00',
        until: SERVER[timeRange]?.[1] ?? '2025-05-31T00:00:00',
        timeRange,
      })),
    };
  });
});
afterEach(() => fetchMock.clearHistory().removeRoutes());

const levels = [
  {
    source: 'dashboard' as const,
    policy: {
      max_span: { quantity: 3, time_grain: 'P1M' },
      max_look_back: { quantity: 13, time_grain: 'P1M' },
      max_look_forward: { quantity: 0, time_grain: 'P1D' },
    },
  },
];

const trigger = () =>
  within(screen.getByTestId(DateFilterTestKey.PopoverOverlay)).getByRole(
    'button',
  );
const content = () => document.querySelector('.time-range-popover');

function renderPicker() {
  render(
    <Provider store={configureMockStore([thunk])({})}>
      <input aria-label="Other field" />
      <DateFilterLabel
        name="time_range"
        value="Last week"
        onChange={jest.fn()}
        timeRangeLimits={{ levels }}
      />
    </Provider>,
  );
}

async function openPicker() {
  await userEvent.click(trigger());
  await screen.findByText('Actual time range');
  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'Last week' })).toBeChecked(),
  );
  screen.getByRole('radio', { name: 'Last week' }).focus();
}

async function closedWithAnimation() {
  expect(content()).toBeInTheDocument();
  await waitFor(() => expect(content()).not.toBeInTheDocument(), {
    timeout: 5000,
  });
}

const waitForTriggerFocus = () =>
  waitFor(() => expect(trigger()).toHaveFocus());

test('with the leave animation: Cancel, Apply, Escape and an empty-page click give focus back to the trigger', async () => {
  renderPicker();

  await openPicker();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await closedWithAnimation();
  await waitForTriggerFocus();

  await openPicker();
  await userEvent.click(screen.getByRole('radio', { name: 'Last month' }));
  await waitFor(
    () => expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled(),
    { timeout: 5000 },
  );
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await closedWithAnimation();
  await waitForTriggerFocus();

  await openPicker();
  await userEvent.type(document.activeElement!, '{Escape}', {
    skipClick: true,
  });
  await closedWithAnimation();
  await waitForTriggerFocus();

  await openPicker();
  await userEvent.click(document.body);
  await closedWithAnimation();
  await waitForTriggerFocus();
}, 60000);

test('with the leave animation: a click on another field keeps its focus', async () => {
  renderPicker();

  await openPicker();
  await userEvent.click(screen.getByLabelText('Other field'));
  await closedWithAnimation();
  expect(screen.getByLabelText('Other field')).toHaveFocus();
}, 30000);

test('with the leave animation: reopening during the leave cancels the pending focus', async () => {
  renderPicker();

  await openPicker();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(content()).toBeInTheDocument();
  await openPicker();
  const lastWeek = screen.getByRole('radio', { name: 'Last week' });

  await waitFor(() => expect(content()).toBeVisible(), { timeout: 5000 });
  expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  expect(lastWeek).toHaveFocus();
}, 30000);
