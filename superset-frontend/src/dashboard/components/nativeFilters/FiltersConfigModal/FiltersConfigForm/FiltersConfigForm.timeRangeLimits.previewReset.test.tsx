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
import { Preset } from '@superset-ui/core';
import {
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { DateFilterTestKey } from 'src/explore/components/controls/DateFilterControl/utils';
import {
  RangeFilterPlugin,
  SelectFilterPlugin,
  TimeColumnFilterPlugin,
  TimeFilterPlugin,
  TimeGrainFilterPlugin,
} from 'src/filters/components';
import * as asyncEvent from 'src/middleware/asyncEvent';
import { supersetGetCache } from 'src/utils/cachedSupersetGet';
import {
  setDelays,
  ALERT_TITLE,
  LIMIT_ERROR,
  REQUIRED_TITLE,
  CHART_DATA,
  mockServer,
  selectFilter,
  renderModal,
  previewCalls,
  saveButton,
  defaultValueBox,
  typeName,
  rename,
  flush,
  rejectPreview,
  previewAlert,
  slot,
} from './FiltersConfigForm.timeRangeLimits.testHelpers';

class PreviewResetPreset extends Preset {
  constructor() {
    super({
      name: 'Filters',
      plugins: [
        new SelectFilterPlugin().configure({ key: 'filter_select' }),
        new RangeFilterPlugin().configure({ key: 'filter_range' }),
        new TimeFilterPlugin().configure({ key: 'filter_time' }),
        new TimeColumnFilterPlugin().configure({ key: 'filter_timecolumn' }),
        new TimeGrainFilterPlugin().configure({ key: 'filter_timegrain' }),
      ],
    });
  }
}

beforeAll(() => {
  new PreviewResetPreset().register();
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

const pickerInSlot = () =>
  !!slot()?.querySelector(`[data-test="${DateFilterTestKey.PopoverOverlay}"]`);

const PREVIEW_OK = {
  result: [{ status: 'success', data: [{ state: 'CA' }], applied_filters: [] }],
};

const previewBodies = () =>
  fetchMock.callHistory
    .calls(CHART_DATA)
    .map(call => JSON.parse(call.options.body as string));

type PreviewBody = {
  datasource?: { id?: number };
  form_data?: { viz_type?: string };
};

// Rejects the previews `reject` picks as UNBOUNDED_RANGE, answers the rest.
const rejectWhen =
  (reject: (body: PreviewBody) => boolean) =>
  ({ options }: { options: { body?: unknown } }) =>
    reject(JSON.parse(String(options.body ?? '{}')))
      ? rejectPreview()
      : PREVIEW_OK;

const rejectSelect = rejectWhen(
  body => body.form_data?.viz_type === 'filter_select',
);

function hold<T>() {
  let release!: (value: T) => void;
  let fail!: (reason: unknown) => void;
  const promise = new Promise<T>((done, failed) => {
    release = done;
    fail = failed;
  });
  return { promise, release, fail };
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

async function pickSecondDataset() {
  const datasetInput = await waitFor(() => {
    const input = document.querySelector('input[aria-label="Dataset"]');
    expect(input).toBeInTheDocument();
    return input as HTMLElement;
  });
  await userEvent.click(datasetInput);
  await userEvent.click(
    (await screen.findAllByText(/second_table/)).find(option =>
      option.closest('.ant-select-item-option'),
    ) as HTMLElement,
  );
  await flush();
  await flush();
}

async function newTimeRangeAfterRejectedValue() {
  supersetGetCache.clear();
  mockServer({ chartData: rejectPreview(), secondDataset: true });
  const onSave = renderModal([], { createNewOnOpen: true });
  await screen.findByText(ALERT_TITLE);
  await changeType(/^value$/i, /^time range$/i);
  await screen.findByRole('checkbox', { name: REQUIRED_TITLE });
  await flush();
  return onSave;
}

async function pickDefault(name: RegExp) {
  await userEvent.click(
    within(slot()!).getByTestId(DateFilterTestKey.PopoverOverlay),
  );
  await screen.findByText('Actual time range');
  if (!screen.queryByRole('radio', { name })) {
    await userEvent.click(
      screen.getByRole('combobox', { name: /^Range type/ }),
    );
    const lists = await waitFor(() => {
      const open = document.querySelectorAll(
        '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
      );
      if (!open.length) {
        throw new Error('The Range type list is not open yet');
      }
      return open;
    });
    await userEvent.click(
      within(lists[lists.length - 1] as HTMLElement).getByText('Last'),
    );
    await screen.findByRole('radio', { name });
  }
  await userEvent.click(screen.getByRole('radio', { name }));
  const apply = screen.getByRole('button', { name: 'Apply' });
  await waitFor(() => expect(apply).toBeEnabled(), { timeout: 4000 });
  await userEvent.click(apply);
  await flush();
}

test('a new Value filter rejected, then Time range shows the picker', async () => {
  await newTimeRangeAfterRejectedValue();
  expect(screen.queryByText('Cannot load filter')).not.toBeInTheDocument();
  expect(pickerInSlot()).toBe(true);
  expect(previewAlert()).not.toBeInTheDocument();
  expect(defaultValueBox()).toBeChecked();
  expect(defaultValueBox()).toBeDisabled();
});

test('after a rejected Value preview, an in-limit Time range default saves', async () => {
  const onSave = await newTimeRangeAfterRejectedValue();
  await pickDefault(/last month/i);
  await rename('Second range');
  await userEvent.click(saveButton());
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const [added] = onSave.mock.calls[0][0].filterChanges.modified;
  expect(added.filterType).toBe('filter_time');
  expect(added.name).toBe('Second range');
  expect(added.defaultDataMask.filterState.value).toBe('Last month');
  expect(added.defaultDataMask.extraFormData).toEqual({
    time_range: 'Last month',
  });
});

test('after a rejected Value preview, an empty Time range default says "Please choose a valid value" and marks the picker invalid', async () => {
  const onSave = await newTimeRangeAfterRejectedValue();
  typeName('Second range');
  expect(
    await screen.findByText('Please choose a valid value'),
  ).toBeInTheDocument();
  expect(screen.queryByText('Cannot load filter')).not.toBeInTheDocument();
  expect(pickerInSlot()).toBe(true);
  expect(saveButton()).toBeDisabled();
  await userEvent.click(saveButton());
  await flush();
  expect(onSave).not.toHaveBeenCalled();
  expect(slot()!.querySelector('[aria-invalid="true"]')).toBeInTheDocument();
});

test('Value, Time range, Value again re-sends one preview and the alert comes back', async () => {
  await newTimeRangeAfterRejectedValue();
  const before = previewCalls().length;
  await changeType(/^time range$/i, /^value$/i);
  expect(await screen.findByText(ALERT_TITLE)).toBeInTheDocument();
  expect(previewCalls().length - before).toBe(1);
  expect(defaultValueBox()).not.toBeChecked();
});

test.each([
  ['Time column', /^time column$/i],
  ['Time grain', /^time grain$/i],
])(
  'a rejected Value preview leaves no alert after a change to %s',
  async (_, to) => {
    mockServer({ chartData: rejectSelect });
    renderModal([], { createNewOnOpen: true });
    await screen.findByText(ALERT_TITLE);
    await changeType(/^value$/i, to);
    expect(previewAlert()).not.toBeInTheDocument();
    await userEvent.click(defaultValueBox());
    await flush();
    await flush();
    expect(screen.queryByText('Cannot load filter')).not.toBeInTheDocument();
    expect(previewAlert()).not.toBeInTheDocument();
  },
);

test('a saved filter whose preview failed shows the picker after a change to Time range', async () => {
  mockServer({ chartData: { status: 500, body: { message: 'Server error' } } });
  const filter = {
    ...selectFilter(),
    defaultDataMask: { extraFormData: {}, filterState: { value: ['CA'] } },
  };
  renderModal([filter], { initialFilterId: 'NATIVE_FILTER-S1' });
  await within(await waitFor(() => slot()!)).findByText('Cannot load filter');
  await changeType(/^value$/i, /^time range$/i);
  await flush();
  expect(screen.queryByText('Cannot load filter')).not.toBeInTheDocument();
  expect(pickerInSlot()).toBe(true);
});

test('a dataset change after a rejected preview sends one new preview and leaves no stale alert', async () => {
  supersetGetCache.clear();
  mockServer({
    chartData: rejectWhen(body => body.datasource?.id !== 2),
    secondDataset: true,
  });
  renderModal([], { createNewOnOpen: true });
  await screen.findByText(ALERT_TITLE);
  const before = previewBodies().length;

  await pickSecondDataset();

  await waitFor(() => expect(previewBodies().length - before).toBe(1));
  expect(previewBodies()[before].datasource.id).toBe(2);
  expect(previewAlert()).not.toBeInTheDocument();
  expect(screen.queryByText('Cannot load filter')).not.toBeInTheDocument();
  await flush();
  expect(previewBodies().length - before).toBe(1);
});

test('Value ticked, then Time column sends two previews and shows only the last answer', async () => {
  mockServer({ chartData: rejectSelect });
  renderModal([], { createNewOnOpen: true });
  await screen.findByText(ALERT_TITLE);
  await userEvent.click(defaultValueBox());
  expect(
    await within(slot()!).findByText(LIMIT_ERROR.message),
  ).toBeInTheDocument();
  const before = previewCalls().length;

  await changeType(/^value$/i, /^time column$/i);
  await flush();

  const sent = previewCalls().slice(before);
  expect(sent.map(formData => formData.viz_type)).toEqual([
    'filter_timecolumn',
    'filter_timecolumn',
  ]);
  expect(screen.queryByText(LIMIT_ERROR.message)).not.toBeInTheDocument();
  expect(screen.queryByText('Cannot load filter')).not.toBeInTheDocument();
  expect(previewAlert()).not.toBeInTheDocument();
});

test('a preview rejection that arrives after a type change changes nothing', async () => {
  const first = hold<object>();
  let calls = 0;
  mockServer({
    chartData: () => {
      calls += 1;
      return calls === 1 ? first.promise : PREVIEW_OK;
    },
  });
  renderModal([], { createNewOnOpen: true });
  await waitFor(() => expect(previewCalls()).toHaveLength(1));
  await changeType(/^value$/i, /^time range$/i);
  await screen.findByRole('checkbox', { name: REQUIRED_TITLE });

  first.release(rejectPreview());
  await flush();
  await flush();

  expect(screen.queryByText('Cannot load filter')).not.toBeInTheDocument();
  expect(screen.queryByText(LIMIT_ERROR.message)).not.toBeInTheDocument();
  expect(previewAlert()).not.toBeInTheDocument();
  expect(pickerInSlot()).toBe(true);
});

test('async: a rejection that arrives after a type change changes nothing', async () => {
  window.featureFlags = {
    TIME_RANGE_LIMITS: true,
    GLOBAL_ASYNC_QUERIES: true,
  };
  mockServer({ chartData: { status: 202, body: { task_ids: ['t1'] } } });
  const job = hold<never>();
  const wait = jest
    .spyOn(asyncEvent, 'waitForAsyncData')
    .mockImplementation(() => job.promise);
  renderModal([], { createNewOnOpen: true });
  await waitFor(() => expect(wait).toHaveBeenCalledTimes(1));
  await changeType(/^value$/i, /^time range$/i);
  await screen.findByRole('checkbox', { name: REQUIRED_TITLE });

  job.fail({ errors: [LIMIT_ERROR] });
  await flush();
  await flush();

  expect(screen.queryByText('Cannot load filter')).not.toBeInTheDocument();
  expect(screen.queryByText(LIMIT_ERROR.message)).not.toBeInTheDocument();
  expect(previewAlert()).not.toBeInTheDocument();
  expect(pickerInSlot()).toBe(true);
});

test("a successful preview answer that arrives after a type change keeps the new type's alert", async () => {
  const first = hold<object>();
  let calls = 0;
  mockServer({
    chartData: () => {
      calls += 1;
      return calls === 1 ? first.promise : rejectPreview();
    },
  });
  renderModal([], { createNewOnOpen: true });
  await waitFor(() => expect(previewCalls()).toHaveLength(1));
  await changeType(/^value$/i, /^time column$/i);
  expect(await screen.findByText(ALERT_TITLE)).toBeInTheDocument();

  first.release(PREVIEW_OK);
  await flush();
  await flush();

  expect(previewAlert()).toBeInTheDocument();
});

test("async: a successful answer that arrives after a type change keeps the new type's alert", async () => {
  window.featureFlags = {
    TIME_RANGE_LIMITS: true,
    GLOBAL_ASYNC_QUERIES: true,
  };
  let calls = 0;
  mockServer({
    chartData: () => {
      calls += 1;
      return calls === 1
        ? { status: 202, body: { task_ids: ['t1'] } }
        : rejectPreview();
    },
  });
  const job = hold<typeof PREVIEW_OK.result>();
  const wait = jest
    .spyOn(asyncEvent, 'waitForAsyncData')
    .mockImplementation(() => job.promise);
  renderModal([], { createNewOnOpen: true });
  await waitFor(() => expect(wait).toHaveBeenCalledTimes(1));
  await changeType(/^value$/i, /^time column$/i);
  expect(await screen.findByText(ALERT_TITLE)).toBeInTheDocument();

  job.release(PREVIEW_OK.result);
  await flush();
  await flush();

  expect(previewAlert()).toBeInTheDocument();
});

test("a successful preview answer that arrives after a dataset change keeps the new dataset's alert", async () => {
  supersetGetCache.clear();
  const first = hold<object>();
  let calls = 0;
  mockServer({
    chartData: () => {
      calls += 1;
      return calls === 1 ? first.promise : rejectPreview();
    },
    secondDataset: true,
  });
  renderModal([], { createNewOnOpen: true });
  await waitFor(() => expect(previewCalls()).toHaveLength(1));

  await pickSecondDataset();
  expect(await screen.findByText(ALERT_TITLE)).toBeInTheDocument();
  expect(previewBodies()[previewBodies().length - 1].datasource.id).toBe(2);

  first.release(PREVIEW_OK);
  await flush();
  await flush();

  expect(previewAlert()).toBeInTheDocument();
});

test('flag off, a failed preview still shows "Cannot load filter" after a change to Time range', async () => {
  window.featureFlags = {};
  mockServer({ chartData: { status: 500, body: { message: 'Server error' } } });
  renderModal([], { createNewOnOpen: true });
  await waitFor(() => expect(previewCalls()).not.toHaveLength(0));
  await flush();
  await userEvent.click(defaultValueBox());
  await within(await waitFor(() => slot()!)).findByText('Cannot load filter');
  const before = previewCalls().length;

  await changeType(/^value$/i, /^time range$/i);
  await flush();
  if (!defaultValueBox().checked) {
    await userEvent.click(defaultValueBox());
    await flush();
  }

  expect(screen.getByText('Cannot load filter')).toBeInTheDocument();
  expect(pickerInSlot()).toBe(false);
  expect(previewCalls()).toHaveLength(before);
});
