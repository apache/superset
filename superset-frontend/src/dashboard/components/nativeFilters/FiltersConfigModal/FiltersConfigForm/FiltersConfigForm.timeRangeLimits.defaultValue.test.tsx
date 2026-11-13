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
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { DateFilterTestKey } from 'src/explore/components/controls/DateFilterControl/utils';
import * as modalUtils from '../utils';
import {
  MainPreset,
  setDelays,
  delayedAnswersPending,
  LIMITS_FAILED,
  LAST_YEAR_FAILURE,
  LIMITS_ALERT,
  REQUIRED_TITLE,
  ALERT_TITLE,
  payload,
  mockServer,
  timeFilter,
  selectFilter,
  renderModal,
  limitCalls,
  saveButton,
  nameInputs,
  listTab,
  typeName,
  rename,
  pickerTrigger,
  flush,
  rejectPreview,
  defaultSlot,
  slotTrigger,
  explain,
  explainAlert,
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

test('a stored "Last year" is checked against policy A', async () => {
  mockServer();
  const onSave = renderModal([timeFilter('NATIVE_FILTER-T1', 'Last year')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });

  const message = await screen.findByText(
    LAST_YEAR_FAILURE,
    {},
    { timeout: 3000 },
  );
  expect(message.closest('.ant-form-item-explain-error')).toBeInTheDocument();
  const slot = document.querySelector(
    '[data-test="default-input"]',
  ) as HTMLElement;
  await waitFor(() =>
    expect(pickerTrigger(slot)).toHaveAttribute('aria-invalid', 'true'),
  );
  expect(listTab('Date')).toHaveClass('errored');
  await userEvent.click(saveButton());
  await flush();
  expect(onSave).not.toHaveBeenCalled();
});

test('a stored "Last month" passes and saves unchanged after a rename', async () => {
  mockServer();
  const filter = timeFilter('NATIVE_FILTER-T1', 'Last month');
  const onSave = renderModal([filter], { initialFilterId: 'NATIVE_FILTER-T1' });
  await screen.findByText(LIMITS_ALERT);
  await rename();
  await userEvent.click(saveButton());
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const [saved] = onSave.mock.calls[0][0].filterChanges.modified;
  expect(saved.name).toBe('Renamed');
  expect(saved.defaultDataMask.filterState.value).toBe('Last month');
  expect(saved.defaultDataMask.extraFormData).toEqual({
    time_range: 'Last month',
  });
  expect(screen.queryByText(/can't be/)).not.toBeInTheDocument();
  expect(
    pickerTrigger(
      document.querySelector('[data-test="default-input"]') as HTMLElement,
    ),
  ).not.toHaveAttribute('aria-invalid');
});

test('an open-ended stored value says "End is required on this dashboard"', async () => {
  mockServer();
  renderModal([timeFilter('NATIVE_FILTER-T1', '2025-01-01 : ')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });
  expect(
    await screen.findByText(
      'End is required on this dashboard',
      {
        selector:
          '.ant-form-item-explain-error *, .ant-form-item-explain-error',
      },
      { timeout: 3000 },
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Ask a dashboard owner/)).not.toBeInTheDocument();
});

test('a late answer for an old value does not replace the current one', async () => {
  mockServer();
  setDelays({ 'Last year': 1500 });
  renderModal([timeFilter('NATIVE_FILTER-T1', 'Last year')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });
  await screen.findByText(LIMITS_ALERT, {}, { timeout: 4000 });
  const slot = document.querySelector(
    '[data-test="default-input"]',
  ) as HTMLElement;
  await userEvent.click(
    within(slot).getByTestId(DateFilterTestKey.PopoverOverlay),
  );
  await screen.findByText('Actual time range');
  await userEvent.click(screen.getByRole('radio', { name: /last month/i }));
  const apply = screen.getByRole('button', { name: 'Apply' });
  await waitFor(() => expect(apply).toBeEnabled(), { timeout: 4000 });
  await userEvent.click(apply);
  await waitFor(() => expect(delayedAnswersPending()).toBe(0), {
    timeout: 3000,
  });
  await flush();
  expect(screen.queryByText(LAST_YEAR_FAILURE)).not.toBeInTheDocument();
});

test('fixing a stored "Last year" to "Last month" clears the mark and saves the new value', async () => {
  mockServer();
  const onSave = renderModal([timeFilter('NATIVE_FILTER-T1', 'Last year')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });
  await screen.findByText(LAST_YEAR_FAILURE, {}, { timeout: 3000 });
  await waitFor(() => expect(listTab('Date')).toHaveClass('errored'));
  const slot = document.querySelector(
    '[data-test="default-input"]',
  ) as HTMLElement;
  await userEvent.click(
    within(slot).getByTestId(DateFilterTestKey.PopoverOverlay),
  );
  await screen.findByText('Actual time range');
  await userEvent.click(screen.getByRole('radio', { name: /last month/i }));
  const apply = screen.getByRole('button', { name: 'Apply' });
  await waitFor(() => expect(apply).toBeEnabled(), { timeout: 4000 });
  await userEvent.click(apply);

  await waitFor(() => expect(saveButton()).toBeEnabled(), { timeout: 3000 });
  expect(screen.queryByText(LAST_YEAR_FAILURE)).not.toBeInTheDocument();
  expect(listTab('Date')).not.toHaveClass('errored');
  await userEvent.click(saveButton());
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  const [saved] = onSave.mock.calls[0][0].filterChanges.modified;
  expect(saved.defaultDataMask.filterState.value).toBe('Last month');
  expect(saved.defaultDataMask.extraFormData).toEqual({
    time_range: 'Last month',
  });
});

test('the Default value picker follows the limits', async () => {
  mockServer();
  renderModal([timeFilter('NATIVE_FILTER-T1')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });
  const slot = await waitFor(() => {
    const element = document.querySelector('[data-test="default-input"]');
    expect(
      within(element as HTMLElement).getByTestId(
        DateFilterTestKey.PopoverOverlay,
      ),
    ).toBeInTheDocument();
    return element as HTMLElement;
  });
  expect(
    await within(slot).findByText(
      "Select a time range within this dashboard's limits.",
    ),
  ).toBeInTheDocument();
  await userEvent.click(
    within(slot).getByTestId(DateFilterTestKey.PopoverOverlay),
  );
  await screen.findByText('Actual time range');
  await userEvent.click(screen.getByRole('combobox', { name: /^Range type/ }));
  await waitFor(() =>
    expect(
      document.querySelector('.ant-select-dropdown-list'),
    ).toBeInTheDocument(),
  );
  const options = Array.from(
    document.querySelectorAll(
      '.ant-select-dropdown-list .ant-select-item-option',
    ),
  ).map(option => option.textContent);
  expect(options).not.toContain('No filter');
  expect(options).toContain('Advanced');
});

test('an unopened time range filter with "Last year" blocks Save, is marked and opened', async () => {
  mockServer();
  const onSave = renderModal(
    [selectFilter(), timeFilter('NATIVE_FILTER-T1', 'Last year')],
    { initialFilterId: 'NATIVE_FILTER-S1' },
  );
  await waitFor(() => expect(limitCalls()).toBe(1));
  await rename();
  await userEvent.click(saveButton());
  await waitFor(() => expect(listTab('Date')).toHaveClass('errored'));
  expect(listTab('Renamed')).not.toHaveClass('errored');
  expect(onSave).not.toHaveBeenCalled();
  expect(await screen.findByText(LAST_YEAR_FAILURE)).toBeInTheDocument();
});

test('an unopened "Last month" saves; no Time Range form mounts', async () => {
  mockServer();
  const onSave = renderModal(
    [selectFilter(), timeFilter('NATIVE_FILTER-T1', 'Last month')],
    { initialFilterId: 'NATIVE_FILTER-S1' },
  );
  await waitFor(() => expect(limitCalls()).toBe(1));
  await rename();
  await userEvent.click(saveButton());
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(listTab('Date')).not.toHaveClass('errored');
  expect(nameInputs()).toHaveLength(1);
});

test('with no rule the unopened filters are not checked', async () => {
  mockServer({ limits: payload(null) });
  const check = jest.spyOn(modalUtils, 'checkTimeRangeDefaults');
  const onSave = renderModal(
    [selectFilter(), timeFilter('NATIVE_FILTER-T1', 'Last year')],
    { initialFilterId: 'NATIVE_FILTER-S1' },
  );
  await waitFor(() => expect(limitCalls()).toBe(1));
  await rename();
  await userEvent.click(saveButton());
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(check).not.toHaveBeenCalled();
});

test('a deleted unopened bad filter does not block the first Save', async () => {
  mockServer();
  const onSave = renderModal(
    [selectFilter(), timeFilter('NATIVE_FILTER-T1', 'Last year')],
    { initialFilterId: 'NATIVE_FILTER-S1' },
  );
  await waitFor(() => expect(limitCalls()).toBe(1));
  const deleteIcon = within(listTab('Date')).getByRole('button', {
    name: 'Remove filter',
  });
  await userEvent.click(deleteIcon);
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await userEvent.click(saveButton());
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0].filterChanges.deleted).toEqual([
    'NATIVE_FILTER-T1',
  ]);
});

test('a11y: a limits error on the default is announced and marks the picker invalid', async () => {
  mockServer();
  renderModal([timeFilter('NATIVE_FILTER-T1', 'Last year')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });

  const message = await screen.findByText(
    LAST_YEAR_FAILURE,
    {},
    { timeout: 3000 },
  );
  expect(message).toHaveAttribute('role', 'alert');
  expect(message.id).toBeTruthy();
  expect(explain()).toContainElement(message);
  await waitFor(() =>
    expect(slotTrigger()).toHaveAttribute('aria-invalid', 'true'),
  );
});

// The picker trigger is always described by its own date label.
const TOOLTIP_ID = 'date-label-time_range';

const triggerDescribedBy = () =>
  (slotTrigger().getAttribute('aria-describedby') ?? '').split(' ');

test('a11y: the picker trigger is described by the limits error and keeps its date label', async () => {
  mockServer();
  renderModal([timeFilter('NATIVE_FILTER-T1', 'Last year')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });

  const message = await screen.findByText(
    LAST_YEAR_FAILURE,
    {},
    { timeout: 3000 },
  );
  await waitFor(() =>
    expect(triggerDescribedBy()).toEqual([TOOLTIP_ID, message.id]),
  );
  expect(document.getElementById(message.id)).toBe(message);
});

test('in filter settings the limits error shows once, on the Default Value field, and describes the trigger', async () => {
  mockServer();
  renderModal([timeFilter('NATIVE_FILTER-T1', 'Last year')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });

  await waitFor(
    () =>
      expect(
        within(defaultSlot()).getAllByText(LAST_YEAR_FAILURE),
      ).toHaveLength(1),
    { timeout: 3000 },
  );
  const [message] = screen.getAllByText(LAST_YEAR_FAILURE);
  expect(explain()).toContainElement(message);
  expect(message.id).toBe('NATIVE_FILTER-T1-default-value-error');
  expect(
    document.getElementById('NATIVE_FILTER-T1-limit-error'),
  ).not.toBeInTheDocument();
  await waitFor(() =>
    expect(triggerDescribedBy()).toEqual([TOOLTIP_ID, message.id]),
  );
  triggerDescribedBy()
    .filter(id => id !== TOOLTIP_ID)
    .forEach(id => expect(document.getElementById(id)).toBeInTheDocument());
});

test('a11y: a cleared limits error leaves only the date label on the trigger', async () => {
  mockServer();
  renderModal([timeFilter('NATIVE_FILTER-T1', 'Last year')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });
  const message = await screen.findByText(
    LAST_YEAR_FAILURE,
    {},
    { timeout: 3000 },
  );
  const errorId = message.id;
  await waitFor(() => expect(triggerDescribedBy()).toContain(errorId));

  await userEvent.click(slotTrigger());
  await screen.findByText('Actual time range');
  await userEvent.click(screen.getByRole('radio', { name: /last month/i }));
  const apply = screen.getByRole('button', { name: 'Apply' });
  await waitFor(() => expect(apply).toBeEnabled(), { timeout: 4000 });
  await userEvent.click(apply);

  await waitFor(
    () => expect(screen.queryByText(LAST_YEAR_FAILURE)).not.toBeInTheDocument(),
    { timeout: 3000 },
  );
  await waitFor(() => expect(triggerDescribedBy()).toEqual([TOOLTIP_ID]));
  expect(slotTrigger()).not.toHaveAttribute('aria-invalid');
});

test('a11y: a default error on the default value keeps its message', async () => {
  mockServer();
  renderModal([], { createNewOnOpen: true });
  await waitFor(() => expect(limitCalls()).toBe(1));
  await userEvent.click(screen.getByText(/^value$/i));
  await userEvent.click(await screen.findByText(/^time range$/i));
  await screen.findByRole('checkbox', { name: REQUIRED_TITLE });

  typeName('Date');
  const message = await screen.findByText('Please choose a valid value');
  expect(message.closest('.ant-form-item-explain-error')).toBeInTheDocument();
  expect(explainAlert()).not.toBeInTheDocument();
  // the empty value ("No filter") fails the limits, so the
  // trigger is invalid; no limits message describes it.
  await waitFor(() =>
    expect(slotTrigger()).toHaveAttribute('aria-invalid', 'true'),
  );
  expect(triggerDescribedBy()).toEqual([TOOLTIP_ID]);
});

test('a11y: limits that fail to load keep the default field message', async () => {
  mockServer({ limits: { status: 503, body: { errors: [] } } });
  renderModal([timeFilter('NATIVE_FILTER-T1', 'Last quarter')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });

  const fieldMessage = await screen.findByText(LIMITS_FAILED, {
    selector: '.ant-form-item-explain-error, .ant-form-item-explain-error *',
  });
  expect(fieldMessage).not.toHaveAttribute('role');
  expect(explainAlert()).not.toBeInTheDocument();
  expect(slotTrigger()).not.toHaveAttribute('aria-invalid');
});

test('a11y: flag off, the default value is unchanged', async () => {
  window.featureFlags = {};
  mockServer();
  renderModal([timeFilter('NATIVE_FILTER-T1', 'Last year')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });

  await waitFor(() => expect(slotTrigger()).toHaveTextContent('Last year'), {
    timeout: 5000,
  });
  await act(() => new Promise(done => setTimeout(done, 200)));
  expect(screen.queryByText(LAST_YEAR_FAILURE)).not.toBeInTheDocument();
  expect(explainAlert()).not.toBeInTheDocument();
  expect(slotTrigger()).not.toHaveAttribute('aria-invalid');
  expect(slotTrigger()).not.toHaveAttribute('aria-expanded');
  expect(slotTrigger()).toHaveAttribute('aria-describedby', TOOLTIP_ID);
});

test('a11y: the filter settings Alerts hide their icons, same size as antd default', async () => {
  mockServer({ limits: { status: 503, body: { errors: [] } } });
  renderModal([timeFilter('NATIVE_FILTER-T1', 'Last quarter')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });
  const failure = (
    await screen.findByText(LIMITS_FAILED, { selector: '.ant-alert-title' })
  ).closest('.ant-alert') as HTMLElement;
  const failureIcon = failure.querySelector('.ant-alert-icon .anticon');
  expect(failureIcon).toHaveAttribute('aria-hidden', 'true');
  expect(failureIcon).not.toHaveAttribute('style');
});

test('a11y: the preview Alert hides its icon at the antd default size', async () => {
  mockServer({ chartData: rejectPreview() });
  renderModal([], { createNewOnOpen: true });

  const preview = (await screen.findByText(ALERT_TITLE)).closest(
    '.ant-alert',
  ) as HTMLElement;
  const previewIcon = preview.querySelector(
    '.ant-alert-icon .anticon',
  ) as HTMLElement;
  expect(previewIcon).toHaveAttribute('aria-hidden', 'true');
  expect(previewIcon).not.toHaveAttribute('style');
});
