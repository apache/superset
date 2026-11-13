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
import { DateFilterTestKey } from 'src/explore/components/controls/DateFilterControl/utils';
import {
  MainPreset,
  setDelays,
  pickOpenOption,
  LIMITS_FAILED,
  LAST_YEAR_FAILURE,
  LIMITS_ALERT,
  LIMITS_SHOWN,
  REQUIRED_TITLE,
  DEFAULT_VALUE,
  rule,
  policy,
  payload,
  setLimitsAnswer,
  mockServer,
  timeFilter,
  selectFilter,
  renderModal,
  limitCalls,
  previewCalls,
  saveButton,
  visibleNameInput,
  listTab,
  typeName,
  rename,
  flush,
} from './FiltersConfigForm.timeRangeLimits.testHelpers';

const mockCustomizationProps: Record<string, unknown>[] = [];

jest.mock('../ConfigModalContent/CustomizationContentRenderer', () => {
  const actual = jest.requireActual(
    '../ConfigModalContent/CustomizationContentRenderer',
  );
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockCustomizationProps.push(props);
      return jest.requireActual('react').createElement(actual.default, props);
    },
  };
});

beforeAll(() => {
  new MainPreset().register();
  fetchMock.mockGlobal();
});

beforeEach(() => {
  window.featureFlags = { TIME_RANGE_LIMITS: true };
  mockCustomizationProps.length = 0;
  setDelays({});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  fetchMock.clearHistory().removeRoutes();
  window.featureFlags = {};
});

test('flag off, the Time Range settings are unchanged', async () => {
  window.featureFlags = {};
  mockServer();
  const errors = jest.spyOn(console, 'error');
  renderModal([timeFilter('NATIVE_FILTER-T1'), selectFilter()], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });

  const box = await screen.findByRole('checkbox', { name: DEFAULT_VALUE });
  expect(box).not.toBeChecked();
  expect(box).toBeEnabled();
  expect(screen.queryByText(LIMITS_SHOWN)).not.toBeInTheDocument();
  expect(
    screen.queryByRole('checkbox', { name: REQUIRED_TITLE }),
  ).not.toBeInTheDocument();
  expect(limitCalls()).toBe(0);

  await userEvent.click(listTab('state'));
  await waitFor(() => expect(previewCalls().length).toBeGreaterThan(0));
  await flush();
  const calls = previewCalls();
  expect(calls.some(formData => formData.type === undefined)).toBe(true);
  expect(calls.every(formData => formData.native_filter_id === undefined)).toBe(
    true,
  );
  expect(limitCalls()).toBe(0);
  expect(
    errors.mock.calls.some(call =>
      String(call[0]).includes('must have a single child'),
    ),
  ).toBe(false);
});

test('flag on, no rule: one GET, default settings, the saved id in the preview', async () => {
  mockServer({ limits: payload(null) });
  renderModal([timeFilter('NATIVE_FILTER-T1'), selectFilter()], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });

  await waitFor(() => expect(limitCalls()).toBe(1));
  const box = await screen.findByRole('checkbox', { name: DEFAULT_VALUE });
  await waitFor(() => expect(box).toBeEnabled());
  expect(box).not.toBeChecked();
  expect(screen.queryByText(LIMITS_SHOWN)).not.toBeInTheDocument();

  await userEvent.click(listTab('state'));
  await waitFor(() =>
    expect(
      previewCalls().filter(formData => formData.type === 'NATIVE_FILTER'),
    ).not.toHaveLength(0),
  );
  expect(
    previewCalls().every(
      formData => formData.native_filter_id === 'NATIVE_FILTER-S1',
    ),
  ).toBe(true);
  expect(limitCalls()).toBe(1);
});

test('one GET per modal open with several filters', async () => {
  mockServer();
  renderModal(
    [
      timeFilter('NATIVE_FILTER-T1', 'Last quarter'),
      timeFilter('NATIVE_FILTER-T2', 'Last month', 'Second'),
      selectFilter(),
    ],
    { initialFilterId: 'NATIVE_FILTER-T1' },
  );
  await screen.findByText(LIMITS_ALERT);
  await userEvent.click(listTab('Second'));
  await userEvent.click(listTab('state'));
  await flush();
  expect(limitCalls()).toBe(1);
});

const dashboardSlice = (overrides: Record<string, unknown> = {}) => ({
  status: 'loaded',
  dashboardId: 1,
  request: 1,
  payload: payload().result,
  charts: {},
  failedBefore: false,
  ...overrides,
});

test('the limits the dashboard holds are used: no GET when the modal opens', async () => {
  mockServer();
  renderModal([timeFilter('NATIVE_FILTER-T1', 'Last quarter')], {
    initialFilterId: 'NATIVE_FILTER-T1',
    timeRangeLimits: dashboardSlice(),
  });

  expect(await screen.findByText(LIMITS_ALERT)).toBeInTheDocument();
  await flush();
  expect(limitCalls()).toBe(0);
});

test('limits the dashboard failed to load fail closed; Retry is one GET through the dashboard and the modal follows', async () => {
  mockServer();
  renderModal([timeFilter('NATIVE_FILTER-T1', 'Last quarter')], {
    initialFilterId: 'NATIVE_FILTER-T1',
    timeRangeLimits: dashboardSlice({
      status: 'failed',
      payload: null,
      failedBefore: true,
    }),
  });

  const retry = await screen.findByRole('button', { name: 'Retry' });
  expect(limitCalls()).toBe(0);
  await userEvent.click(retry);

  expect(await screen.findByText(LIMITS_ALERT)).toBeInTheDocument();
  expect(limitCalls()).toBe(1);
  expect(
    screen.queryByRole('button', { name: 'Retry' }),
  ).not.toBeInTheDocument();
});

test('one GET with only display controls; the customization renderer gets no limits', async () => {
  mockServer();
  renderModal([], {
    customizations: [
      {
        id: 'CHART_CUSTOMIZATION-1',
        type: 'CHART_CUSTOMIZATION',
        name: 'Group by',
        filterType: 'chart_customization_dynamic_groupby',
        targets: [{ datasetId: 1 }],
        scope: { rootPath: ['ROOT_ID'], excluded: [] },
        controlValues: {},
        defaultDataMask: {},
        cascadeParentIds: [],
        description: '',
      },
    ],
  });
  await waitFor(() => expect(limitCalls()).toBe(1));
  await flush();
  expect(limitCalls()).toBe(1);
  expect(mockCustomizationProps.length).toBeGreaterThan(0);
  expect(
    mockCustomizationProps.every(props => !('timeRangeLimits' in props)),
  ).toBe(true);
});

test('the limits info Alert under the existing info, full width, no action, only for Time Range', async () => {
  mockServer();
  renderModal(
    [timeFilter('NATIVE_FILTER-T1', 'Last quarter'), selectFilter()],
    {
      initialFilterId: 'NATIVE_FILTER-T1',
    },
  );

  const message = await screen.findByText(LIMITS_ALERT);
  const alert = message.closest('.ant-alert') as HTMLElement;
  expect(alert).toHaveClass('ant-alert-info');
  expect(alert.querySelector('.ant-alert-icon .anticon')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  expect(alert.querySelector('.ant-alert-action')).not.toBeInTheDocument();
  expect(within(alert).queryByRole('button')).not.toBeInTheDocument();
  expect(within(alert).queryByRole('link')).not.toBeInTheDocument();
  expect(alert.parentElement).toHaveClass('ant-flex', 'ant-flex-vertical');
  expect(screen.queryByText(/Times in/)).not.toBeInTheDocument();
  const info = screen.getByText(/Dashboard time range filters apply/);
  expect(
    info.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();

  await userEvent.click(listTab('state'));
  await flush();
  expect(
    within(visibleNameInput().closest('.ant-tabs') as HTMLElement).queryByText(
      LIMITS_SHOWN,
    ),
  ).not.toBeInTheDocument();
});

test('with no span rule the Alert gives the dashboard limit line, without the time zone', async () => {
  mockServer({
    limits: payload(
      policy({
        max_look_back: rule(13, 'P1M'),
        max_look_forward: rule(0, 'P1D'),
      }),
    ),
  });
  renderModal([timeFilter('NATIVE_FILTER-T1', 'Last quarter')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });

  const message = await screen.findByText(
    'Limit on this dashboard: within the last 13 months, no future dates',
  );
  expect(message.closest('.ant-alert')).toHaveClass('ant-alert-info');
  expect(screen.queryByText(/Times in/)).not.toBeInTheDocument();
  expect(screen.queryByText(/This dashboard limits/)).not.toBeInTheDocument();
});

test('a new time range filter needs a default; Save with none shows the default error', async () => {
  mockServer();
  const onSave = renderModal([], { createNewOnOpen: true });
  await waitFor(() => expect(limitCalls()).toBe(1));
  await userEvent.click(screen.getByText(/^value$/i));
  await userEvent.click(await screen.findByText(/^time range$/i));

  const box = await screen.findByRole('checkbox', { name: REQUIRED_TITLE });
  expect(box).toBeChecked();
  expect(box).toBeDisabled();
  const tooltipIcon = within(box.closest('label') as HTMLElement).getByRole(
    'button',
  );
  await userEvent.hover(tooltipIcon);
  expect(
    await screen.findByText(
      'Default value must be set when "Filter has default value" is checked',
    ),
  ).toBeInTheDocument();

  typeName('Date');
  expect(
    await screen.findByText('Please choose a valid value'),
  ).toBeInTheDocument();
  expect(document.querySelector('[role="tab"].errored')).toBeInTheDocument();
  expect(saveButton()).toBeDisabled();
  await userEvent.click(saveButton());
  await flush();
  expect(onSave).not.toHaveBeenCalled();
});

test('changing the type to Select gives the default control back, default cleared', async () => {
  mockServer();
  renderModal([], { createNewOnOpen: true });
  await waitFor(() => expect(limitCalls()).toBe(1));
  await userEvent.click(screen.getByText(/^value$/i));
  await userEvent.click(await screen.findByText(/^time range$/i));
  await screen.findByRole('checkbox', { name: REQUIRED_TITLE });

  await userEvent.click(
    screen
      .getAllByText(/^time range$/i)
      .find(text => text.closest('.ant-select')) as HTMLElement,
  );
  await pickOpenOption(/^value$/i);

  const box = await screen.findByRole('checkbox', { name: DEFAULT_VALUE });
  expect(box).toBeEnabled();
  expect(box).not.toBeChecked();
});

test('while the GET is pending: required, Loading with aria-busy, Save disabled; then "Last year" blocks Save', async () => {
  let answer: (value: unknown) => void = () => {};
  mockServer({
    limits: new Promise(done => {
      answer = done;
    }),
  });
  const onSave = renderModal(
    [timeFilter('NATIVE_FILTER-T1', 'Last year'), selectFilter()],
    { initialFilterId: 'NATIVE_FILTER-T1' },
  );

  const box = await screen.findByRole('checkbox', { name: REQUIRED_TITLE });
  expect(box).toBeChecked();
  expect(box).toBeDisabled();
  const slot = document.querySelector('[data-test="default-input"]')!;
  const busy = slot.querySelector('[aria-busy="true"]');
  expect(busy).toBeInTheDocument();
  expect(within(busy as HTMLElement).getByRole('status')).toBeInTheDocument();
  expect(
    within(slot as HTMLElement).queryByTestId(DateFilterTestKey.PopoverOverlay),
  ).not.toBeInTheDocument();
  typeName('Renamed');
  await act(async () => {});
  expect(saveButton()).toBeDisabled();

  await act(async () => answer(payload()));
  expect(await screen.findByText(LAST_YEAR_FAILURE)).toBeInTheDocument();
  await userEvent.click(saveButton());
  await flush();
  expect(onSave).not.toHaveBeenCalled();
});

test('a 503 also keeps the default required', async () => {
  mockServer({ limits: { status: 503, body: { errors: [] } } });
  renderModal([timeFilter('NATIVE_FILTER-T1', 'Last quarter')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });
  await screen.findByText(LIMITS_FAILED, { selector: '.ant-alert-title' });
  const box = screen.getByRole('checkbox', { name: REQUIRED_TITLE });
  expect(box).toBeChecked();
  expect(box).toBeDisabled();
});

test('Save is disabled while pending in a modal with only a Select filter', async () => {
  mockServer({ limits: new Promise(() => {}) });
  renderModal([selectFilter()], { initialFilterId: 'NATIVE_FILTER-S1' });
  await screen.findAllByTestId('filters-config-modal__name-input');
  fireEvent.change(visibleNameInput(), { target: { value: 'Renamed' } });
  await act(() => new Promise(done => setTimeout(done, 200)));
  expect(saveButton()).toBeDisabled();
});

test('a 503 fails closed: the limits-failed alert with Retry, Save blocked, the time range filter marked', async () => {
  mockServer({ limits: { status: 503, body: { errors: [] } } });
  const onSave = renderModal(
    [timeFilter('NATIVE_FILTER-T1', 'Last quarter'), selectFilter()],
    { initialFilterId: 'NATIVE_FILTER-S1' },
  );
  await waitFor(() => expect(limitCalls()).toBe(1));
  await rename();
  await userEvent.click(saveButton());
  await waitFor(() => expect(listTab('Date')).toHaveClass('errored'));
  expect(listTab('Renamed')).not.toHaveClass('errored');
  expect(onSave).not.toHaveBeenCalled();

  // The hidden Select filter form shows the same Alert.
  expect(
    await screen.findAllByText(LIMITS_FAILED, { selector: '.ant-alert-title' }),
  ).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  expect(screen.queryByText(LIMITS_SHOWN)).not.toBeInTheDocument();
  expect(
    await screen.findByText(LIMITS_FAILED, {
      selector: '.ant-form-item-explain-error, .ant-form-item-explain-error *',
    }),
  ).toBeInTheDocument();
  await act(() => new Promise(done => setTimeout(done, 200)));
  expect(limitCalls()).toBe(1);
});

test('Retry asks once per click; a good answer gives the limits Alert', async () => {
  mockServer({ limits: { status: 503, body: { errors: [] } } });
  renderModal([timeFilter('NATIVE_FILTER-T1', 'Last quarter')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });
  const retry = await screen.findByRole('button', { name: 'Retry' });
  expect(limitCalls()).toBe(1);
  await userEvent.click(retry);
  await waitFor(() => expect(limitCalls()).toBe(2));
  await flush();
  expect(limitCalls()).toBe(2);

  setLimitsAnswer(payload());
  await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByText(LIMITS_ALERT)).toBeInTheDocument();
  expect(limitCalls()).toBe(3);
  expect(
    screen.queryByRole('button', { name: 'Retry' }),
  ).not.toBeInTheDocument();
});

test('no answer in 10 s fails closed, no automatic retry', async () => {
  jest.useFakeTimers();
  mockServer({ limits: new Promise(() => {}) });
  renderModal([timeFilter('NATIVE_FILTER-T1', 'Last quarter')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();
    });
  }
  await act(async () => {
    jest.advanceTimersByTime(9900);
  });
  expect(
    screen.queryByRole('button', { name: 'Retry' }),
  ).not.toBeInTheDocument();
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
  for (let i = 0; i < 10; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();
    });
  }
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  expect(
    screen.getByText(LIMITS_FAILED, { selector: '.ant-alert-title' }),
  ).toBeInTheDocument();
  await act(async () => {
    jest.advanceTimersByTime(60000);
  });
  expect(limitCalls()).toBe(1);
});

test('a dataset limit applies to the default', async () => {
  mockServer({
    limits: payload(policy(), {
      datasets: [
        { id: 7, name: 'calls', policy: policy({ max_span: rule(4, 'P1W') }) },
      ],
    }),
  });
  renderModal([timeFilter('NATIVE_FILTER-T1', 'Last quarter')], {
    initialFilterId: 'NATIVE_FILTER-T1',
  });
  expect(
    await screen.findByText('Longer than this dashboard allows (4 weeks)', {
      selector: '.ant-form-item-explain-error *, .ant-form-item-explain-error',
    }),
  ).toBeInTheDocument();
});
