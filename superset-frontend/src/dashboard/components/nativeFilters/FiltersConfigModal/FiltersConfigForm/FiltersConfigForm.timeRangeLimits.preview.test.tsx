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
import fetchMock from 'fetch-mock';
import {
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import * as chartAction from 'src/components/Chart/chartAction';
import * as asyncEvent from 'src/middleware/asyncEvent';
import {
  MainPreset,
  setDelays,
  ALERT_TITLE,
  LIMIT_ERROR,
  mockServer,
  selectFilter,
  renderModal,
  previewCalls,
  saveButton,
  defaultValueBox,
  rename,
  flush,
  rejectPreview,
  typedCalls,
  previewAlert,
  slot,
} from './FiltersConfigForm.timeRangeLimits.testHelpers';

beforeAll(() => {
  new MainPreset().register();
  fetchMock.mockGlobal();
});

beforeEach(() => {
  window.featureFlags = { TIME_RANGE_LIMITS: true };
  setDelays({});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  fetchMock.clearHistory().removeRoutes();
  window.featureFlags = {};
});

test('a saved filter previews with its id', async () => {
  mockServer();
  renderModal([selectFilter()], { initialFilterId: 'NATIVE_FILTER-S1' });
  await waitFor(() => expect(typedCalls()).not.toHaveLength(0));
  await flush();
  expect(
    previewCalls().every(formData => formData.type === 'NATIVE_FILTER'),
  ).toBe(true);
  expect(typedCalls()[0].native_filter_id).toBe('NATIVE_FILTER-S1');
});

test('a new filter skips the call with no type, then sends one full call while unticked', async () => {
  mockServer();
  renderModal([], { createNewOnOpen: true });
  await waitFor(() => expect(typedCalls()).toHaveLength(1));
  await flush();
  expect(defaultValueBox()).not.toBeChecked();
  expect(previewCalls()).toHaveLength(1);
  expect(typedCalls()[0].native_filter_id).toBeUndefined();
});

test('sync: UNBOUNDED_RANGE on a new unticked filter shows the alert under the checkbox', async () => {
  mockServer({ chartData: rejectPreview() });
  const errors = jest.spyOn(console, 'error');
  renderModal([], { createNewOnOpen: true });

  const title = await screen.findByText(ALERT_TITLE);
  expect(
    screen.getByText(
      'Time range limits are on. Save the filter to load its values here, or set a pre-filter time range.',
    ),
  ).toBeInTheDocument();
  expect(slot()).not.toBeInTheDocument();
  const alertItem = title.closest('.ant-alert') as HTMLElement;
  const boxItem = defaultValueBox().closest('.ant-form-item') as HTMLElement;
  expect(boxItem.contains(alertItem)).toBe(false);
  expect(
    boxItem.compareDocumentPosition(alertItem) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    errors.mock.calls.some(call =>
      String(call[0]).includes('must have a single child'),
    ),
  ).toBe(false);
});

test('untick, tick, untick swaps the alert and the default display', async () => {
  mockServer({ chartData: rejectPreview() });
  renderModal([], { createNewOnOpen: true });
  await screen.findByText(ALERT_TITLE);

  await userEvent.click(defaultValueBox());
  expect(defaultValueBox()).toBeChecked();
  expect(
    await within(slot()!).findByText(LIMIT_ERROR.message),
  ).toBeInTheDocument();
  expect(previewAlert()).not.toBeInTheDocument();

  await userEvent.click(defaultValueBox());
  expect(defaultValueBox()).not.toBeChecked();
  expect(await screen.findByText(ALERT_TITLE)).toBeInTheDocument();
});

test('flag off, an UNBOUNDED_RANGE preview on a saved Select filter keeps the default error display', async () => {
  window.featureFlags = {};
  mockServer({ chartData: rejectPreview() });
  const filter = {
    ...selectFilter(),
    defaultDataMask: { extraFormData: {}, filterState: { value: ['CA'] } },
  };
  renderModal([filter], { initialFilterId: 'NATIVE_FILTER-S1' });
  await waitFor(() => expect(slot()).toBeInTheDocument());
  expect(
    await within(slot()!).findByText(LIMIT_ERROR.message),
  ).toBeInTheDocument();
  expect(previewAlert()).not.toBeInTheDocument();
});

test('ticked with a stored default shows the alert and the stored value, no spinner', async () => {
  mockServer({ chartData: rejectPreview() });
  const filter = {
    ...selectFilter(),
    defaultDataMask: {
      extraFormData: {},
      filterState: { value: ['CA'] },
    },
  };
  renderModal([filter], { initialFilterId: 'NATIVE_FILTER-S1' });
  expect(await screen.findByText(ALERT_TITLE)).toBeInTheDocument();
  expect(defaultValueBox()).toBeChecked();
  await flush();
  await waitFor(() => expect(slot()).toBeInTheDocument());
  expect(within(slot()!).queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByText('Cannot load filter')).not.toBeInTheDocument();
  expect(within(slot()!).getByText('CA')).toBeInTheDocument();
});

test('a successful preview after an UNBOUNDED_RANGE answer hides the alert', async () => {
  let answer: unknown = rejectPreview();
  mockServer({ chartData: () => answer as object });
  const filter = {
    ...selectFilter(),
    defaultDataMask: { extraFormData: {}, filterState: { value: ['CA'] } },
  };
  renderModal([filter], { initialFilterId: 'NATIVE_FILTER-S1' });
  expect(await screen.findByText(ALERT_TITLE)).toBeInTheDocument();
  await flush();
  const posts = previewCalls().length;
  answer = {
    result: [
      { status: 'success', data: [{ state: 'CA' }], applied_filters: [] },
    ],
  };

  await userEvent.click(screen.getByRole('button', { name: 'sync' }));

  await waitFor(() => expect(previewCalls().length).toBeGreaterThan(posts));
  await waitFor(() => expect(previewAlert()).not.toBeInTheDocument());
  expect(within(slot()!).getByText('CA')).toBeInTheDocument();
});

test('ticked with no value shows the default error, not the alert', async () => {
  mockServer({ chartData: rejectPreview() });
  const filter = selectFilter();
  filter.controlValues = { ...filter.controlValues, enableEmptyFilter: true };
  renderModal([filter], { initialFilterId: 'NATIVE_FILTER-S1' });
  await waitFor(() => expect(typedCalls()).not.toHaveLength(0));
  expect(
    await within(slot()!).findByText(LIMIT_ERROR.message),
  ).toBeInTheDocument();
  expect(previewAlert()).not.toBeInTheDocument();
  await rename();
  await userEvent.click(saveButton());
  expect(
    await screen.findByText('Please choose a valid value'),
  ).toBeInTheDocument();
  expect(previewAlert()).not.toBeInTheDocument();
});

test.each([
  [
    'another reason',
    rejectPreview({
      ...LIMIT_ERROR,
      message: "Range can't be longer than 3 months.",
      extra: { reason_code: 'MAX_SPAN_EXCEEDED' },
    }),
  ],
  ['another error', { status: 500, body: { message: 'Server error' } }],
])('%s keeps the default display', async (_, response) => {
  mockServer({ chartData: response });
  const filter = {
    ...selectFilter(),
    defaultDataMask: { extraFormData: {}, filterState: { value: ['CA'] } },
  };
  renderModal([filter], { initialFilterId: 'NATIVE_FILTER-S1' });
  await waitFor(() => expect(typedCalls()).not.toHaveLength(0));
  await flush();
  expect(
    await within(slot()!).findByText('Cannot load filter'),
  ).toBeInTheDocument();
  expect(previewAlert()).not.toBeInTheDocument();
});

test('async: the limit error from the re-sent request shows the alert', async () => {
  window.featureFlags = {
    TIME_RANGE_LIMITS: true,
    GLOBAL_ASYNC_QUERIES: true,
  };
  let posts = 0;
  mockServer({
    chartData: () => {
      posts += 1;
      return posts === 1
        ? { status: 202, body: { task_ids: ['t1'] } }
        : rejectPreview();
    },
  });
  jest
    .spyOn(asyncEvent, 'waitForAsyncData')
    .mockImplementation((_job, refetch) => refetch());
  renderModal([], { createNewOnOpen: true });

  expect(await screen.findByText(ALERT_TITLE)).toBeInTheDocument();
  expect(posts).toBe(2);
  expect(screen.queryByText('Cannot load filter')).not.toBeInTheDocument();
});

test('flag off, the preview request carries no abort signal', async () => {
  window.featureFlags = {};
  const request = jest.spyOn(chartAction, 'requestChartDataResolved');
  mockServer();
  renderModal([selectFilter()], { initialFilterId: 'NATIVE_FILTER-S1' });
  await waitFor(() => expect(request).toHaveBeenCalled());
  request.mock.calls.forEach(([params, signal]) => {
    expect(signal).toBeUndefined();
    expect(params.requestParams).not.toHaveProperty('signal');
  });
});
