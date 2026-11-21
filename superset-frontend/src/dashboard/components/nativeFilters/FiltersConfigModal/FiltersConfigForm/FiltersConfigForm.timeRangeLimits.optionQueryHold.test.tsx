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
  act,
  fireEvent,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { supersetGetCache } from 'src/utils/cachedSupersetGet';
import {
  MainPreset,
  CHART_DATA,
  LIMITS_FAILED,
  REQUIRED_TITLE,
  mockServer,
  payload,
  selectFilter,
  renderModal,
  limitCalls,
  previewCalls,
  saveButton,
  defaultValueBox,
  rename,
  flush,
  slot,
  setDelays,
  setLimitsAnswer,
} from './FiltersConfigForm.timeRangeLimits.testHelpers';

beforeAll(() => {
  new MainPreset().register();
  fetchMock.mockGlobal();
});

beforeEach(() => {
  window.featureFlags = { TIME_RANGE_LIMITS: true };
  setDelays({});
  supersetGetCache.clear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  fetchMock.clearHistory().removeRoutes();
  window.featureFlags = {};
});

const FAILED_ANSWER = { status: 503, body: { errors: [] } };
const ALERT = { selector: '.ant-alert-title' };

const previewSignals = () =>
  fetchMock.callHistory
    .calls(CHART_DATA)
    .map(call => call.signal ?? call.options.signal);

const livePreviews = () =>
  previewSignals().filter(signal => !signal?.aborted).length;

type PreviewCall = {
  options: { body?: unknown; signal?: AbortSignal | null };
  signal?: AbortSignal | null;
};

// Only a call with a live signal reaches the network; fetch-retry's later
// re-calls of an aborted preview carry the aborted signal.
let sent: { viz_type?: string }[] = [];
const recordPreview = ({ options, signal }: PreviewCall) => {
  if (!(signal ?? options.signal)?.aborted) {
    sent.push(JSON.parse(String(options.body ?? '{}')).form_data);
  }
  return {
    result: [
      { status: 'success', data: [{ state: 'CA' }], applied_filters: [] },
    ],
  };
};

const rangeFilter = (id = 'NATIVE_FILTER-R1') => ({
  ...selectFilter(id),
  filterType: 'filter_range',
});

function hold<T>() {
  let release!: (value: T) => void;
  const promise = new Promise<T>(done => {
    release = done;
  });
  return { promise, release };
}

async function changeType(from: RegExp, to: RegExp) {
  await userEvent.click(
    screen
      .getAllByText(from)
      .find(
        element =>
          element.closest('.ant-select') &&
          !element.closest('.ant-select-dropdown'),
      ) as HTMLElement,
  );
  await userEvent.click(
    (await screen.findAllByText(to)).find(option =>
      option.closest('.ant-select-item-option'),
    ) as HTMLElement,
  );
  await flush();
  await flush();
}

async function openFailedAfterPreview(filter: Record<string, unknown>) {
  const gate = hold<unknown>();
  mockServer({
    limits: gate.promise,
    chartData: () => new Promise(() => {}),
  });
  renderModal([filter], { initialFilterId: filter.id as string });
  await waitFor(() => expect(previewCalls()).not.toHaveLength(0));
  await flush();
  await act(async () => gate.release(FAILED_ANSWER));
  await screen.findByRole('button', { name: 'Retry' });
  await flush();
}

async function addFilterAfterFailure() {
  sent = [];
  mockServer({
    limits: FAILED_ANSWER,
    chartData: recordPreview,
    secondDataset: true,
  });
  renderModal([]);
  await waitFor(() => expect(limitCalls()).toBe(1));
  await act(() => new Promise(done => setTimeout(done, 200)));
  fireEvent.mouseEnter(screen.getByTestId('new-item-dropdown-button'));
  fireEvent.click(await screen.findByRole('menuitem', { name: /add filter/i }));
  await screen.findByRole('button', { name: 'Retry' });
  await flush();
  await flush();
}

test('a saved Value filter with a default: the mount previews are aborted when the limits fail, the slot and the Alert show the limits text, a failing Retry sends nothing, a good one sends one preview', async () => {
  await openFailedAfterPreview({
    ...selectFilter(),
    defaultDataMask: { extraFormData: {}, filterState: { value: ['CA'] } },
  });

  expect(previewSignals().every(signal => signal?.aborted)).toBe(true);
  expect(defaultValueBox()).toBeChecked();
  expect(within(slot()!).getByText(LIMITS_FAILED)).toBeInTheDocument();
  expect(screen.getByText(LIMITS_FAILED, ALERT)).toBeInTheDocument();

  setLimitsAnswer(FAILED_ANSWER);
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(limitCalls()).toBe(2));
  await screen.findByRole('button', { name: 'Retry' });
  await flush();
  expect(livePreviews()).toBe(0);

  fetchMock.removeRoutes();
  mockServer({ limits: payload() });
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(livePreviews()).toBe(1));
  await flush();
  await flush();
  expect(livePreviews()).toBe(1);
  expect(within(slot()!).queryByText(LIMITS_FAILED)).not.toBeInTheDocument();
});

test('a saved Numerical range filter with no default: the mount preview is aborted, the Alert shows the limits text, a good Retry sends one preview', async () => {
  await openFailedAfterPreview(rangeFilter());

  expect(previewSignals().every(signal => signal?.aborted)).toBe(true);
  expect(slot()).not.toBeInTheDocument();
  expect(screen.getByText(LIMITS_FAILED, ALERT)).toBeInTheDocument();

  fetchMock.removeRoutes();
  mockServer({ limits: payload() });
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(livePreviews()).toBe(1));
  await flush();
  await flush();
  expect(livePreviews()).toBe(1);
  expect(screen.queryByText(LIMITS_FAILED, ALERT)).not.toBeInTheDocument();
});

test("a new filter's first preview, sent while the limits load, is aborted when they fail; a good Retry sends one", async () => {
  const gate = hold<unknown>();
  mockServer({
    limits: gate.promise,
    chartData: () => new Promise(() => {}),
    secondDataset: true,
  });
  renderModal([], { createNewOnOpen: true });
  await waitFor(() => expect(previewCalls()).toHaveLength(1));
  await act(async () => gate.release(FAILED_ANSWER));
  await screen.findByRole('button', { name: 'Retry' });
  await flush();

  expect(previewSignals().every(signal => signal?.aborted)).toBe(true);
  expect(screen.getByText(LIMITS_FAILED, ALERT)).toBeInTheDocument();

  setLimitsAnswer(payload());
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(livePreviews()).toBe(1));
  await flush();
  await flush();
  expect(livePreviews()).toBe(1);
});

test.each([
  ['Value', null, 'filter_select'],
  ['Numerical range', /^numerical range$/i, 'filter_range'],
])(
  'a new %s filter added after the limits failed sends no preview until they load, then one',
  async (_, type, vizType) => {
    await addFilterAfterFailure();
    if (type) {
      await changeType(/^value$/i, type);
    }
    await flush();
    expect(sent).toHaveLength(0);
    expect(defaultValueBox()).not.toBeChecked();
    expect(screen.getByText(LIMITS_FAILED, ALERT)).toBeInTheDocument();

    setLimitsAnswer(payload());
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    await flush();
    await flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].viz_type).toBe(vizType);
  },
);

test('a Value filter with no default saves while the limits failed', async () => {
  mockServer({ limits: FAILED_ANSWER });
  const onSave = renderModal([selectFilter()], {
    initialFilterId: 'NATIVE_FILTER-S1',
  });
  await waitFor(() => expect(limitCalls()).toBe(1));
  await flush();
  await rename();
  await userEvent.click(saveButton());
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
});

test('a new filter added after the limits failed, Value to Time range, sends no preview and leaves no stale preview error', async () => {
  await addFilterAfterFailure();

  await changeType(/^value$/i, /^time range$/i);
  await screen.findByRole('checkbox', { name: REQUIRED_TITLE });
  await flush();

  expect(sent).toHaveLength(0);
  expect(screen.queryByText('Cannot load filter')).not.toBeInTheDocument();
  expect(screen.getByText(LIMITS_FAILED, ALERT)).toBeInTheDocument();
});
