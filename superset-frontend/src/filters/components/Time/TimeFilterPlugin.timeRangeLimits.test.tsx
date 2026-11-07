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
import { createRef } from 'react';
import fetchMock from 'fetch-mock';
import rison from 'rison';
import {
  AppSection,
  Behavior,
  SupersetClient,
  type FilterState,
  type TimeRangeLimits,
} from '@superset-ui/core';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { DateFilterTestKey } from 'src/explore/components/controls/DateFilterControl/utils';
import TimeFilterPlugin from './TimeFilterPlugin';
import { PluginFilterTimeProps } from './types';

const SERVER: Record<string, [string, string]> = {
  'today : now': ['2025-05-31T00:00:00', '2025-05-31T14:30:00'],
  'No filter': ['', ''],
  'Last year': ['2024-05-31T00:00:00', '2025-05-31T00:00:00'],
  'Last month': ['2025-04-30T00:00:00', '2025-05-31T00:00:00'],
  '2023-01-01 : 2023-02-01': ['2023-01-01T00:00:00', '2023-02-01T00:00:00'],
};

beforeAll(() => fetchMock.mockGlobal());
afterAll(() => fetchMock.hardReset());
beforeEach(() => {
  fetchMock.get('glob:*/api/v1/time_range/*', ({ url }: { url: string }) => {
    const request = rison.decode(new URL(url).searchParams.get('q')!) as
      | string
      | { timeRange: string }[];
    const items =
      typeof request === 'string' ? [{ timeRange: request }] : request;
    return {
      result: items.map(({ timeRange }) => {
        const [since, until] = SERVER[timeRange] ?? ['', ''];
        return { since, until, timeRange, shift: null };
      }),
    };
  });
});
afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

const LIMITS: TimeRangeLimits = {
  levels: [
    {
      source: 'dashboard',
      policy: {
        max_span: { quantity: 3, time_grain: 'P1M' },
        max_look_back: { quantity: 13, time_grain: 'P1M' },
        max_look_forward: { quantity: 0, time_grain: 'P1D' },
      },
    },
  ],
  dashboardId: 1,
};

function renderPlugin(
  timeRangeLimits?: TimeRangeLimits,
  filterState: FilterState = { value: undefined },
) {
  const setDataMask = jest.fn();
  const propsOf = (limits: TimeRangeLimits | undefined, state: FilterState) =>
    ({
      behaviors: [Behavior.NativeFilter],
      data: [],
      formData: {
        datasource: '',
        viz_type: 'filter_time',
        inView: true,
        nativeFilterId: 'NATIVE_FILTER-1',
        timeRangeLimits: limits,
      },
      filterState: state,
      height: 32,
      width: 300,
      inputRef: { current: null },
      setDataMask,
      setHoveredFilter: jest.fn(),
      unsetHoveredFilter: jest.fn(),
      setFocusedFilter: jest.fn(),
      unsetFocusedFilter: jest.fn(),
      setFilterActive: jest.fn(),
    }) as unknown as PluginFilterTimeProps;
  const { rerender } = render(
    <TimeFilterPlugin {...propsOf(timeRangeLimits, filterState)} />,
    { useRedux: true },
  );
  return {
    setDataMask,
    rerender: (limits?: TimeRangeLimits, state = filterState) =>
      rerender(<TimeFilterPlugin {...propsOf(limits, state)} />),
  };
}

const triggerButton = () =>
  within(screen.getByTestId(DateFilterTestKey.PopoverOverlay)).getByRole(
    'button',
  );

const frameOptions = async () => {
  await userEvent.click(triggerButton());
  await screen.findByText('Actual time range');
  await userEvent.click(screen.getByRole('combobox', { name: /^Range type/ }));
  await waitFor(() =>
    expect(
      document.querySelector('.ant-select-dropdown-list'),
    ).toBeInTheDocument(),
  );
  return Array.from(
    document.querySelectorAll(
      '.ant-select-dropdown-list .ant-select-item-option',
    ),
  ).map(option => option.textContent);
};

test('the limits in formData reach the picker', async () => {
  renderPlugin(LIMITS);

  expect(
    await screen.findByText(
      "Select a time range within this dashboard's limits.",
    ),
  ).toBeInTheDocument();
  expect(await frameOptions()).not.toContain('No filter');
});

test('without limits in formData the filter bar picker still lists "No filter"', async () => {
  renderPlugin();

  expect(await frameOptions()).toContain('No filter');
  expect(
    screen.queryByText("Select a time range within this dashboard's limits."),
  ).not.toBeInTheDocument();
});

test('limits on: a value over the span is set with its error in one data mask, with the span error text', async () => {
  const { setDataMask } = renderPlugin(LIMITS, { value: 'Last year' });

  await waitFor(() => expect(setDataMask).toHaveBeenCalled());
  expect(setDataMask).toHaveBeenCalledTimes(1);
  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: { time_range: 'Last year' },
    filterState: {
      value: 'Last year',
      validateStatus: 'error',
      limitInvalid: true,
      validateMessage: 'Longer than 3 months',
    },
  });
});

test('limits on: any other first failure gets the picker text', async () => {
  const { setDataMask } = renderPlugin(LIMITS, {
    value: '2023-01-01 : 2023-02-01',
  });

  await waitFor(() => expect(setDataMask).toHaveBeenCalledTimes(1));
  expect(setDataMask.mock.calls[0][0].filterState).toEqual({
    value: '2023-01-01 : 2023-02-01',
    validateStatus: 'error',
    limitInvalid: true,
    validateMessage: expect.stringMatching(/^Start can't be earlier than /),
  });
});

test('limits on: a valid value is set without the error keys', async () => {
  const { setDataMask } = renderPlugin(LIMITS, { value: 'Last month' });

  await waitFor(() => expect(setDataMask).toHaveBeenCalledTimes(1));
  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: { time_range: 'Last month' },
    filterState: { value: 'Last month' },
  });
});

test('limits that arrive late are checked against the current value', async () => {
  const { setDataMask, rerender } = renderPlugin(undefined, {
    value: 'Last year',
  });
  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: { time_range: 'Last year' },
    filterState: { value: 'Last year' },
  });

  rerender(LIMITS);

  await waitFor(() =>
    expect(setDataMask).toHaveBeenLastCalledWith({
      extraFormData: { time_range: 'Last year' },
      filterState: {
        value: 'Last year',
        validateStatus: 'error',
        limitInvalid: true,
        validateMessage: 'Longer than 3 months',
      },
    }),
  );
});

test('limits on: a failed check is not cached, so the same value is checked again after it', async () => {
  const realGet = SupersetClient.get.bind(SupersetClient);
  let down = true;
  const get = jest
    .spyOn(SupersetClient, 'get')
    .mockImplementation(request =>
      down
        ? Promise.reject({ error: 'Request timed out', statusText: 'timeout' })
        : realGet(request),
    );
  const state: FilterState = { value: 'Last month' };
  const { setDataMask, rerender } = renderPlugin(LIMITS, state);

  await waitFor(() => expect(setDataMask).toHaveBeenCalledTimes(1));
  expect(setDataMask.mock.calls[0][0].filterState).toMatchObject({
    validateStatus: 'error',
    limitInvalid: true,
  });
  const requests = get.mock.calls.length;
  down = false;

  rerender(LIMITS, { ...state, limitInvalid: true });

  await waitFor(() => expect(setDataMask).toHaveBeenCalledTimes(2));
  expect(get.mock.calls.length).toBeGreaterThan(requests);
  expect(setDataMask).toHaveBeenLastCalledWith({
    extraFormData: { time_range: 'Last month' },
    filterState: { value: 'Last month' },
  });
  get.mockRestore();
});

test('limits on: a checked result is still reused for the same value', async () => {
  const get = jest.spyOn(SupersetClient, 'get');
  const state: FilterState = { value: 'Last month' };
  const { setDataMask, rerender } = renderPlugin(LIMITS, state);

  await waitFor(() => expect(setDataMask).toHaveBeenCalledTimes(1));
  const requests = get.mock.calls.length;

  rerender(LIMITS, { ...state, limitInvalid: true });

  await waitFor(() => expect(setDataMask).toHaveBeenCalledTimes(2));
  expect(get.mock.calls.length).toBe(requests);
  get.mockRestore();
});

test('limits on: the filter error shows under the picker', async () => {
  renderPlugin(LIMITS, {
    value: 'Last year',
    validateStatus: 'error',
    limitInvalid: true,
    validateMessage: 'Longer than 3 months',
  });

  const message = await screen.findByText('Longer than 3 months');
  expect(message).toHaveAttribute('id', 'NATIVE_FILTER-1-limit-error');
  expect(triggerButton()).toHaveAttribute('aria-invalid', 'true');
});

test('limits off: the value is set at once without error keys', () => {
  const { setDataMask } = renderPlugin(undefined, { value: 'Last year' });

  expect(setDataMask).toHaveBeenCalledTimes(1);
  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: { time_range: 'Last year' },
    filterState: { value: 'Last year' },
  });
  expect(document.querySelector('.ant-form-item')).not.toBeInTheDocument();
});

const INVALID: FilterState = {
  value: 'Last year',
  validateStatus: 'error',
  limitInvalid: true,
  validateMessage: 'Longer than 3 months',
};

function renderFocusable(
  limits: TimeRangeLimits | undefined,
  filterState: FilterState,
  isOverflowingFilterBar = false,
) {
  const inputRef = createRef<HTMLDivElement>();
  render(
    <>
      <div id="filter-name-NATIVE_FILTER-1">Time Range</div>
      <TimeFilterPlugin
        {...({
          behaviors: [Behavior.NativeFilter],
          data: [],
          formData: {
            datasource: '',
            viz_type: 'filter_time',
            inView: true,
            nativeFilterId: 'NATIVE_FILTER-1',
            timeRangeLimits: limits,
          },
          filterState,
          height: 32,
          width: 300,
          inputRef,
          isOverflowingFilterBar,
          setDataMask: jest.fn(),
          setHoveredFilter: jest.fn(),
          unsetHoveredFilter: jest.fn(),
          setFocusedFilter: jest.fn(),
          unsetFocusedFilter: jest.fn(),
          setFilterActive: jest.fn(),
        } as unknown as PluginFilterTimeProps)}
      />
    </>,
    { useRedux: true },
  );
  return inputRef;
}

test('focus sent to the filter (setDirectPathToChild) lands on the time range trigger, and Enter opens the picker', async () => {
  const inputRef = renderFocusable(LIMITS, INVALID);
  const trigger = triggerButton();

  act(() => inputRef.current!.focus());

  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-invalid', 'true');
  await userEvent.keyboard('{Enter}');
  expect(await screen.findByText('Actual time range')).toBeInTheDocument();
});

test('without limits focus stays on the container, as without limits', () => {
  const inputRef = renderFocusable(undefined, { value: 'Last year' });

  act(() => inputRef.current!.focus());

  expect(inputRef.current).toHaveFocus();
});

test('with the picker open, focus on the container does not move back to the trigger', async () => {
  const inputRef = renderFocusable(LIMITS, INVALID, true);
  const trigger = triggerButton();
  await userEvent.click(trigger);
  await screen.findByText('Actual time range');

  act(() => inputRef.current!.focus());

  expect(trigger).not.toHaveFocus();
  expect(inputRef.current).toHaveFocus();
  expect(screen.getByText('Actual time range')).toBeInTheDocument();
});

test('focus on an element inside the container stays there', () => {
  const inputRef = renderFocusable(LIMITS, INVALID);
  const trigger = triggerButton();
  const inner = document.createElement('div');
  inner.tabIndex = 0;
  inputRef.current!.appendChild(inner);

  act(() => inner.focus());

  expect(inner).toHaveFocus();
  expect(trigger).not.toHaveFocus();
  inner.remove();
});

test('the trigger is named by the filter name and its value', async () => {
  renderFocusable(LIMITS, { value: 'Last month' });

  expect(
    await screen.findByRole('button', { name: 'Time Range Last month' }),
  ).toHaveAttribute(
    'aria-labelledby',
    'filter-name-NATIVE_FILTER-1 date-label-NATIVE_FILTER-1',
  );
});

test('without limits the trigger keeps the default name', () => {
  renderFocusable(undefined, { value: 'Last month' });

  expect(triggerButton()).toHaveAttribute(
    'aria-labelledby',
    'filter-name-NATIVE_FILTER-1',
  );
});

const DEFAULT_VALUE_ERROR_ID = 'NATIVE_FILTER-1-default-value-error';

function renderIn(
  appSection: AppSection | undefined,
  limits: TimeRangeLimits | undefined,
  filterState: FilterState,
) {
  const setDataMask = jest.fn();
  render(
    <>
      {appSection === AppSection.FilterConfigModal &&
        filterState.validateMessage && (
          <span id={DEFAULT_VALUE_ERROR_ID} role="alert">
            {filterState.validateMessage}
          </span>
        )}
      <TimeFilterPlugin
        {...({
          appSection,
          behaviors: [Behavior.NativeFilter],
          data: [],
          formData: {
            datasource: '',
            viz_type: 'filter_time',
            inView: true,
            nativeFilterId: 'NATIVE_FILTER-1',
            timeRangeLimits: limits,
          },
          filterState,
          height: 32,
          width: 300,
          inputRef: { current: null },
          setDataMask,
          setHoveredFilter: jest.fn(),
          unsetHoveredFilter: jest.fn(),
          setFocusedFilter: jest.fn(),
          unsetFocusedFilter: jest.fn(),
          setFilterActive: jest.fn(),
        } as unknown as PluginFilterTimeProps)}
      />
    </>,
    { useRedux: true },
  );
  return { setDataMask };
}

const triggerDescribedBy = () =>
  (triggerButton().getAttribute('aria-describedby') ?? '').split(' ');

test('in filter settings the plugin shows no message of its own; the trigger is described by the Default Value error', async () => {
  renderIn(
    AppSection.FilterConfigModal,
    { ...LIMITS, describedBy: DEFAULT_VALUE_ERROR_ID },
    INVALID,
  );

  await waitFor(() =>
    expect(triggerDescribedBy()).toContain(DEFAULT_VALUE_ERROR_ID),
  );
  expect(screen.getAllByText('Longer than 3 months')).toHaveLength(1);
  expect(
    document.getElementById('NATIVE_FILTER-1-limit-error'),
  ).not.toBeInTheDocument();
  expect(triggerDescribedBy()).not.toContain('NATIVE_FILTER-1-limit-error');
  triggerDescribedBy()
    .filter(id => id && id !== 'test-id')
    .forEach(id => expect(document.getElementById(id)).toBeInTheDocument());
  expect(triggerButton()).toHaveAttribute('aria-invalid', 'true');
});

test('in the filter bar the plugin shows its message once and the trigger is described by it', async () => {
  renderIn(undefined, LIMITS, INVALID);

  const [message, ...others] = await screen.findAllByText(
    'Longer than 3 months',
  );
  expect(others).toHaveLength(0);
  expect(message).toHaveAttribute('id', 'NATIVE_FILTER-1-limit-error');
  await waitFor(() =>
    expect(triggerDescribedBy()).toContain('NATIVE_FILTER-1-limit-error'),
  );
});

test('limits off in filter settings is unchanged', () => {
  const { setDataMask } = renderIn(AppSection.FilterConfigModal, undefined, {
    value: 'Last year',
  });

  expect(setDataMask).toHaveBeenCalledTimes(1);
  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: { time_range: 'Last year' },
    filterState: { value: 'Last year' },
  });
  expect(document.querySelector('.ant-form-item')).not.toBeInTheDocument();
});

test('without form data, the plugin renders nothing and does not throw', () => {
  const props = {
    behaviors: [Behavior.NativeFilter],
    data: [],
    formData: undefined,
    filterState: { value: undefined },
    height: 32,
    width: 300,
    inputRef: { current: null },
    setDataMask: jest.fn(),
    setHoveredFilter: jest.fn(),
    unsetHoveredFilter: jest.fn(),
    setFocusedFilter: jest.fn(),
    unsetFocusedFilter: jest.fn(),
    setFilterActive: jest.fn(),
  } as unknown as PluginFilterTimeProps;
  render(<TimeFilterPlugin {...props} />, { useRedux: true });
  expect(
    document.querySelector(`[data-test="${DateFilterTestKey.PopoverOverlay}"]`),
  ).toBeNull();
});

test('a failed range lookup shows a control-only message without claiming chart queries are paused', async () => {
  fetchMock.removeRoutes();
  fetchMock.get('glob:*/api/v1/time_range/*', { status: 500, body: {} });
  const state: FilterState = { value: 'Last month' };
  const { setDataMask, rerender } = renderPlugin(LIMITS, state);

  await waitFor(() => expect(setDataMask).toHaveBeenCalledTimes(1));
  const failedState = setDataMask.mock.calls[0][0].filterState;
  expect(failedState).toEqual({
    value: 'Last month',
    validateStatus: 'error',
    limitInvalid: true,
    validateMessage: 'Time range could not be checked.',
  });
  rerender(LIMITS, failedState);
  expect(
    await screen.findByText('Time range could not be checked.'),
  ).toHaveAttribute('id', 'NATIVE_FILTER-1-limit-error');

  await userEvent.click(triggerButton());

  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Time range could not be checked.',
    ),
  );
  expect(screen.queryByText(/Queries are paused/)).not.toBeInTheDocument();
});
