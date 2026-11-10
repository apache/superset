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
  act,
  render,
  screen,
  userEvent,
  waitFor,
  fireEvent,
  selectOption,
  within,
} from 'spec/helpers/testing-library';

import {
  NO_TIME_RANGE,
  fetchTimeRange,
  SupersetClient,
  type Policy,
  type Source,
  type TimeRangeLimits,
} from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import { Form, FormItem } from '@superset-ui/core/components';
import {
  PopoverProps,
  SHIFT_INTO_VIEWPORT,
} from '../../ControlPopover/ControlPopover';
import DateFilterLabel from '..';
import type { PartitionFilterMapping } from '@superset-ui/chart-controls';
import { DateFilterControlProps } from '../types';
import { DateFilterTestKey } from '../utils';

// A Proxy, not a spread copy: the package imports itself, so a copy taken
// while it is still loading would miss exports like getClientErrorObject.
jest.mock('@superset-ui/core', () => {
  const actual = jest.requireActual('@superset-ui/core');
  const mockFetch = jest.fn();
  return new Proxy(actual, {
    get: (target, name) =>
      name === 'fetchTimeRange' ? mockFetch : target[name],
  });
});

const mockedFetchTimeRange = fetchTimeRange as jest.MockedFunction<
  typeof fetchTimeRange
>;

const FIELD_TOOLTIP = '2024-01-01 ≤ col < 2024-01-08';
const DESCRIPTION_TOOLTIP =
  'This control filters the whole chart based on the selected time range.';

const mockPopoverProps: PopoverProps[] = [];
jest.mock('@superset-ui/core/components', () => {
  const actual = jest.requireActual('@superset-ui/core/components');
  const Probe = (props: PopoverProps) => {
    mockPopoverProps.push(props);
    return <actual.Popover {...props} />;
  };
  return new Proxy(actual, {
    get: (target, name) => (name === 'Popover' ? Probe : target[name]),
  });
});

const mockStore = configureMockStore([thunk]);

const defaultProps = {
  onChange: jest.fn(),
  onClosePopover: jest.fn(),
  onOpenPopover: jest.fn(),
};

beforeEach(() => {
  mockedFetchTimeRange.mockReset();
  mockedFetchTimeRange.mockResolvedValue({ value: FIELD_TOOLTIP });
  mockPopoverProps.length = 0;
});

afterEach(() => {
  jest.useRealTimers();
});

function setup(
  props: Omit<DateFilterControlProps, 'name'> = defaultProps,
  store: any = mockStore({}),
) {
  return (
    <Provider store={store}>
      <DateFilterLabel name="time_range" {...props} />
    </Provider>
  );
}

test('DateFilter with default props', async () => {
  render(setup());
  // label
  expect(screen.getByText(NO_TIME_RANGE)).toBeInTheDocument();

  // should be popover by default
  await userEvent.click(screen.getByText(NO_TIME_RANGE));
  expect(
    screen.getByTestId(DateFilterTestKey.PopoverOverlay),
  ).toBeInTheDocument();
});

test('DateFilter should be applied the global config time_filter from the store', async () => {
  render(
    setup(
      defaultProps,
      mockStore({
        common: { conf: { DEFAULT_TIME_FILTER: 'Last week' } },
      }),
    ),
  );
  // the label should be 'Last week'
  expect(screen.getByText('Last week')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Last week'));
  expect(screen.getByTestId(DateFilterTestKey.CommonFrame)).toBeInTheDocument();
});

test('Open and close popover', async () => {
  render(setup());

  // click "Cancel"
  await userEvent.click(screen.getByText(NO_TIME_RANGE));
  expect(defaultProps.onOpenPopover).toHaveBeenCalled();
  expect(screen.getByText('Edit time range')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Cancel'));
  expect(defaultProps.onClosePopover).toHaveBeenCalled();
  expect(screen.queryByText('Edit time range')).not.toBeInTheDocument();

  // click "Apply"
  await userEvent.click(screen.getByText(NO_TIME_RANGE));
  expect(defaultProps.onOpenPopover).toHaveBeenCalled();
  expect(screen.getByText('Edit time range')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Apply'));
  expect(defaultProps.onClosePopover).toHaveBeenCalled();
  expect(screen.queryByText('Edit time range')).not.toBeInTheDocument();
});

test('DateFilter popover should attach to document.body when not overflowing', async () => {
  render(setup({ ...defaultProps, isOverflowingFilterBar: false }));

  await userEvent.click(screen.getByText(NO_TIME_RANGE));

  const popover = document.querySelector<HTMLElement>('.time-range-popover');
  expect(popover?.parentElement).toBe(document.body);
  expect(popover).toHaveStyle({
    width: 'min(600px, calc(100vw - 32px))',
  });
});

test('DateFilter popover shifts into the viewport', async () => {
  render(setup());

  await userEvent.click(screen.getByText(NO_TIME_RANGE));

  await waitFor(() => {
    expect(mockPopoverProps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          autoAdjustOverflow: SHIFT_INTO_VIEWPORT,
        }),
      ]),
    );
  });
});

test('DateFilter popover should attach to document.body even when overflowing in filter bar', async () => {
  render(setup({ ...defaultProps, isOverflowingFilterBar: true }));

  await userEvent.click(screen.getByText(NO_TIME_RANGE));

  const popover = document.querySelector<HTMLElement>('.time-range-popover');

  expect(popover?.parentElement).toBe(document.body);
  expect(popover).toHaveStyle({
    width: 'min(600px, calc(100vw - 32px))',
  });
});

test('DateFilter should properly handle isOverflowingFilterBar prop changes', async () => {
  const { rerender } = render(
    setup({ ...defaultProps, isOverflowingFilterBar: false }),
  );

  // When not overflowing, popover should attach to document.body
  await userEvent.click(screen.getByText(NO_TIME_RANGE));
  const popover = document.querySelector('.time-range-popover');
  expect(popover?.parentElement).toBe(document.body);

  await userEvent.click(screen.getByText('Cancel'));

  // Popover should continue to attach to document.body even when overflowing
  rerender(setup({ ...defaultProps, isOverflowingFilterBar: true }));
  await userEvent.click(screen.getByText(NO_TIME_RANGE));

  const popoverAfterRerender = document.querySelector('.time-range-popover');

  expect(popoverAfterRerender?.parentElement).toBe(document.body);
});

test('applies a configured displayFormat to the evaluated range but leaves the human-readable pill untouched', async () => {
  mockedFetchTimeRange.mockImplementation(
    async (_value, _columnPlaceholder, _shifts, dateFormat) =>
      dateFormat
        ? { value: `2024-01-01 ≤ col < 2024-01-08 (${dateFormat})` }
        : { value: FIELD_TOOLTIP },
  );

  render(
    setup({
      ...defaultProps,
      value: 'Last week',
      displayFormat: '%d-%m-%Y',
    }),
  );

  // the pill shows the raw human-readable value regardless of displayFormat
  expect(await screen.findByText('Last week')).toBeInTheDocument();

  // the tooltip shows the evaluated range, formatted with displayFormat
  await userEvent.hover(screen.getByText('Last week'));
  expect(await screen.findByRole('tooltip')).toHaveTextContent(
    '2024-01-01 ≤ col < 2024-01-08 (%d-%m-%Y)',
  );
});

test('regression: Apply during a pending debounced draft fetch must still update the pill', async () => {
  // Reproduces the maintainer-identified race: the user edits the draft
  // range (scheduling a 500ms debounced preview fetch), then clicks Apply
  // before that timer fires. The Apply-triggered fetch (effect 1) must not
  // be discarded just because the leftover draft fetch (effect 2) resolves
  // its own request-tracking after Apply's fetch started.
  jest.useFakeTimers({ advanceTimers: true });

  const pendingResolvers: Array<(result: { value: string }) => void> = [];
  mockedFetchTimeRange.mockImplementation(
    () =>
      new Promise(resolve => {
        pendingResolvers.push(resolve);
      }),
  );

  const onChange = jest.fn();
  const { rerender } = render(
    setup({ ...defaultProps, onChange, value: 'Last week' }),
  );

  // Settle every fetch effect-1 issues on mount (useCSSTextTruncation's
  // ref/measurement can cause it to re-run once after the initial paint),
  // so validTimeRange reflects the settled 'Last week' state and Apply is
  // enabled before we start the actual scenario.
  await act(async () => {
    pendingResolvers.forEach(resolve =>
      resolve({ value: 'evaluated: Last week' }),
    );
  });

  // open the popover and wait for Apply to be enabled
  await userEvent.click(screen.getByText('Last week'));
  await waitFor(() => {
    expect(screen.getByText('Apply').closest('button')).not.toBeDisabled();
  });
  const baseRequestCount = pendingResolvers.length;

  // change the draft selection to 'Last month' — this schedules effect 2's
  // 500ms debounced draft-preview fetch
  fireEvent.click(screen.getByText('Last month'));

  // click Apply well before that debounce timer fires
  await act(async () => {
    jest.advanceTimersByTime(100);
  });
  fireEvent.click(screen.getByText('Apply'));
  expect(onChange).toHaveBeenCalledWith('Last month');

  // simulate the real parent (TimeFilterPlugin) re-rendering with the
  // applied value, exactly as it would after onChange updates formData
  rerender(setup({ ...defaultProps, onChange, value: 'Last month' }));

  // effect 1 (driven by the new `value` prop) starts its own fetch
  await waitFor(() => {
    expect(pendingResolvers.length).toBe(baseRequestCount + 1);
  });
  const applyRequestIndex = baseRequestCount;

  // the leftover debounce timer from before Apply now fires and starts
  // effect 2's fetch for the same value, *before* effect 1's fetch above
  // has resolved
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  await waitFor(() => {
    expect(pendingResolvers.length).toBe(baseRequestCount + 2);
  });
  const staleDraftRequestIndex = baseRequestCount + 1;

  // effect 1's (older, Apply-triggered) fetch finally resolves
  await act(async () => {
    pendingResolvers[applyRequestIndex]({ value: 'evaluated: Last month' });
  });

  // the pill must reflect the applied selection, not the stale pre-Apply one
  expect(screen.getByText('Last month')).toBeInTheDocument();
  expect(screen.queryByText('Last week')).not.toBeInTheDocument();

  // drain effect 2's own fetch so it doesn't dangle past the test
  await act(async () => {
    pendingResolvers[staleDraftRequestIndex]({
      value: 'evaluated: Last month',
    });
  });
});

test('hovering the description icon does not show the date range tooltip', async () => {
  const tooltipOnClick = jest.fn();
  render(
    setup({
      ...defaultProps,
      value: 'Last week',
      label: 'Date Range',
      description: DESCRIPTION_TOOLTIP,
      hovered: true,
      tooltipOnClick,
    }),
  );

  await waitFor(() => {
    expect(screen.getByText('Last week')).toBeInTheDocument();
  });

  await userEvent.hover(screen.getByText('Last week'));
  expect(await screen.findByRole('tooltip')).toHaveTextContent(FIELD_TOOLTIP);

  const descriptionIcon = screen.getByRole('button', {
    name: 'Show info tooltip',
  });
  fireEvent.focus(descriptionIcon);

  await waitFor(() => {
    expect(screen.getByRole('tooltip')).toHaveTextContent(DESCRIPTION_TOOLTIP);
    expect(screen.getByRole('tooltip')).not.toHaveTextContent(FIELD_TOOLTIP);
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
  });

  fireEvent.blur(descriptionIcon);
  await waitFor(() => {
    expect(screen.getByRole('tooltip')).toHaveTextContent(FIELD_TOOLTIP);
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
  });

  await userEvent.unhover(screen.getByText('Last week'));
  await waitFor(() => {
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  await userEvent.hover(descriptionIcon);

  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveTextContent(DESCRIPTION_TOOLTIP);
  expect(tooltip).not.toHaveTextContent(FIELD_TOOLTIP);
  expect(screen.getAllByRole('tooltip')).toHaveLength(1);

  await userEvent.unhover(descriptionIcon);
  await waitFor(() => {
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  fireEvent.keyDown(descriptionIcon, { key: 'Enter' });
  expect(tooltipOnClick).toHaveBeenCalled();
});

const RANGE_TYPE_LABEL = 'Range type';
const INVALID_EXPRESSION_ERROR = 'Invalid time range expression';

const FRAME_MARKERS = {
  Common: () => screen.queryByTestId(DateFilterTestKey.CommonFrame),
  Calendar: () => screen.queryByText('Configure Time Range: Previous...'),
  Current: () => screen.queryByText('Configure Time Range: Current...'),
  Custom: () => screen.queryByText('Configure custom time range'),
  Advanced: () => screen.queryByText('Configure Advanced Time Range'),
  'No filter': () => screen.queryByTestId(DateFilterTestKey.NoFilter),
};

type FrameName = keyof typeof FRAME_MARKERS;

async function expectOnlyFrame(frame: FrameName) {
  await waitFor(() => {
    expect(FRAME_MARKERS[frame]()).toBeInTheDocument();
  });
  (Object.keys(FRAME_MARKERS) as FrameName[])
    .filter(other => other !== frame)
    .forEach(other => {
      expect(FRAME_MARKERS[other]()).not.toBeInTheDocument();
    });
}

test.each<[string, FrameName, string]>([
  ['No filter', 'No filter', 'No filter'],
  ['Last week', 'Common', 'Last'],
  ['previous calendar month', 'Calendar', 'Previous'],
  ['Current quarter', 'Current', 'Current'],
  ['2021-03-16T00:00:00 : 2021-03-17T00:00:00', 'Custom', 'Custom'],
  ['Last week : tomorrow', 'Advanced', 'Advanced'],
])(
  'opens on the frame that matches the value "%s"',
  async (value, expectedFrame, expectedSelectLabel) => {
    render(setup({ ...defaultProps, value }));

    await userEvent.click(await screen.findByRole('button'));

    await expectOnlyFrame(expectedFrame);
    expect(screen.getByTitle(expectedSelectLabel)).toBeInTheDocument();
  },
);

test.each<[string, FrameName]>([
  ['Previous', 'Calendar'],
  ['Current', 'Current'],
  ['Custom', 'Custom'],
  ['Advanced', 'Advanced'],
  ['No filter', 'No filter'],
])(
  'range type select switches from the Last frame to the %s frame',
  async (optionLabel, expectedFrame) => {
    render(setup({ ...defaultProps, value: 'Last week' }));
    await userEvent.click(screen.getByText('Last week'));
    await expectOnlyFrame('Common');

    await selectOption(optionLabel, RANGE_TYPE_LABEL);

    await expectOnlyFrame(expectedFrame);
  },
);

test('range type select switches back to the Last frame from another frame', async () => {
  render(setup({ ...defaultProps, value: 'Last week' }));
  await userEvent.click(screen.getByText('Last week'));
  await selectOption('Advanced', RANGE_TYPE_LABEL);
  await expectOnlyFrame('Advanced');

  await selectOption('Last', RANGE_TYPE_LABEL);

  await expectOnlyFrame('Common');
});

test('selecting the No filter frame previews No filter as the actual time range', async () => {
  render(setup({ ...defaultProps, value: 'Last week' }));
  await userEvent.click(screen.getByText('Last week'));

  await selectOption('No filter', RANGE_TYPE_LABEL);

  await expectOnlyFrame('No filter');
  await waitFor(
    () => {
      expect(
        within(screen.getByText('Actual time range').parentElement!).getByText(
          'No filter',
        ),
      ).toBeInTheDocument();
    },
    { timeout: 3000 },
  );
});

test('Apply after selecting the No filter frame saves the No filter range', async () => {
  const onChange = jest.fn();
  render(setup({ ...defaultProps, onChange, value: 'Last week' }));
  await userEvent.click(screen.getByText('Last week'));
  await selectOption('No filter', RANGE_TYPE_LABEL);

  await userEvent.click(screen.getByTestId(DateFilterTestKey.ApplyButton));

  expect(onChange).toHaveBeenCalledWith(NO_TIME_RANGE);
});

test('an invalid Advanced expression shows the error and disables Apply', async () => {
  mockedFetchTimeRange.mockImplementation(async value =>
    value.includes('bogus')
      ? { error: INVALID_EXPRESSION_ERROR }
      : { value: FIELD_TOOLTIP },
  );
  const onChange = jest.fn();
  render(setup({ ...defaultProps, onChange, value: 'Last week' }));
  await userEvent.click(screen.getByText('Last week'));
  await selectOption('Advanced', RANGE_TYPE_LABEL);
  await waitFor(() => {
    expect(screen.getByTestId(DateFilterTestKey.ApplyButton)).toBeEnabled();
  });

  await userEvent.type(screen.getAllByRole('textbox')[0], 'bogus');

  expect(
    await screen.findByText(INVALID_EXPRESSION_ERROR, {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  expect(screen.getByTestId(DateFilterTestKey.ApplyButton)).toBeDisabled();
  await userEvent.click(screen.getByTestId(DateFilterTestKey.ApplyButton));
  expect(onChange).not.toHaveBeenCalled();
});

test('correcting an invalid Advanced expression clears the error and re-enables Apply', async () => {
  mockedFetchTimeRange.mockImplementation(async value =>
    value.includes('bogus')
      ? { error: INVALID_EXPRESSION_ERROR }
      : { value: FIELD_TOOLTIP },
  );
  render(setup({ ...defaultProps, value: 'Last week' }));
  await userEvent.click(screen.getByText('Last week'));
  await selectOption('Advanced', RANGE_TYPE_LABEL);
  const sinceInput = screen.getAllByRole('textbox')[0];
  await userEvent.type(sinceInput, 'bogus');
  await screen.findByText(INVALID_EXPRESSION_ERROR, {}, { timeout: 3000 });

  await userEvent.clear(sinceInput);
  await userEvent.type(sinceInput, 'today');

  await waitFor(
    () => {
      expect(
        screen.queryByText(INVALID_EXPRESSION_ERROR),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId(DateFilterTestKey.ApplyButton)).toBeEnabled();
    },
    { timeout: 3000 },
  );
});

test('Cancel restores the frame guessed from the saved value', async () => {
  const onChange = jest.fn();
  render(setup({ ...defaultProps, onChange, value: 'Last week' }));
  await userEvent.click(screen.getByText('Last week'));
  await selectOption('Advanced', RANGE_TYPE_LABEL);
  await expectOnlyFrame('Advanced');

  await userEvent.click(screen.getByTestId(DateFilterTestKey.CancelButton));
  await waitFor(() => {
    expect(screen.queryByText('Edit time range')).not.toBeInTheDocument();
  });
  await userEvent.click(screen.getByText('Last week'));

  await expectOnlyFrame('Common');
  expect(onChange).not.toHaveBeenCalled();
});

test('Cancel discards an unsaved range selection', async () => {
  render(setup({ ...defaultProps, value: 'Last week' }));
  await userEvent.click(screen.getByText('Last week'));
  await userEvent.click(screen.getByLabelText('Last month'));

  await userEvent.click(screen.getByTestId(DateFilterTestKey.CancelButton));
  await waitFor(() => {
    expect(screen.queryByText('Edit time range')).not.toBeInTheDocument();
  });
  await userEvent.click(screen.getByText('Last week'));

  expect(await screen.findByLabelText('Last week')).toBeChecked();
  expect(screen.getByLabelText('Last month')).not.toBeChecked();
});

test('without a partition mapping the trigger is not wrapped in a flex row', async () => {
  // A flex wrapper makes the trigger a flex item, which shrank the Time Range
  // box in the ad-hoc filter popover to its label (250px against 320px).
  render(setup());
  const trigger = await screen.findByTestId(DateFilterTestKey.PopoverOverlay);
  expect(trigger.closest('.ant-flex')).toBeNull();
  expect(
    screen.queryByTestId('partition-pruning-indicator'),
  ).not.toBeInTheDocument();
});

test('with a partition mapping the glyph sits beside a trigger that fills the row', async () => {
  const partitionMapping: PartitionFilterMapping = {
    partition_column: 'dt',
    mapped_column: 'event_time',
    active: true,
    evaluable: true,
    is_monotonic: true,
    mirrorable_operators: ['TEMPORAL_RANGE'],
  };
  render(setup({ ...defaultProps, partitionMapping }));
  const trigger = await screen.findByTestId(DateFilterTestKey.PopoverOverlay);
  const row = trigger.closest('.ant-flex');
  expect(row).not.toBeNull();
  expect(
    within(row as HTMLElement).getByTestId('partition-pruning-indicator'),
  ).toBeInTheDocument();
});

/*
 * Time range limits. The server's clock is 2025-05-31 14:30; its answers below
 * are the ones /api/v1/time_range/ gave for these ranges at that time.
 */

const SERVER: Record<string, [string, string]> = {
  'today : now': ['2025-05-31T00:00:00', '2025-05-31T14:30:00'],
  'Last day': ['2025-05-30T00:00:00', '2025-05-31T00:00:00'],
  'Last week': ['2025-05-24T00:00:00', '2025-05-31T00:00:00'],
  'Last month': ['2025-04-30T00:00:00', '2025-05-31T00:00:00'],
  'Last 3 months': ['2025-08-04T00:00:00', '2025-11-04T00:00:00'],
  'Last quarter': ['2025-02-28T00:00:00', '2025-05-31T00:00:00'],
  'Last year': ['2024-05-31T00:00:00', '2025-05-31T00:00:00'],
  'previous calendar week': ['2025-05-19T00:00:00', '2025-05-26T00:00:00'],
  'previous calendar month': ['2025-04-01T00:00:00', '2025-05-01T00:00:00'],
  'previous calendar quarter': ['2025-01-01T00:00:00', '2025-04-01T00:00:00'],
  'previous calendar year': ['2024-01-01T00:00:00', '2025-01-01T00:00:00'],
  'Current day': ['2025-05-31T00:00:00', '2025-06-01T00:00:00'],
  'Current week': ['2025-05-26T00:00:00', '2025-06-02T00:00:00'],
  'Current month': ['2025-05-01T00:00:00', '2025-06-01T00:00:00'],
  'Current quarter': ['2025-04-01T00:00:00', '2025-07-01T00:00:00'],
  'Current year': ['2025-01-01T00:00:00', '2026-01-01T00:00:00'],
  [NO_TIME_RANGE]: ['', ''],
  ' : ': ['', ''],
  '2025-01-01 : ': ['2025-01-01T00:00:00', ''],
};

const START_AFTER_END =
  'Unexpected time range: From date cannot be larger than to date';

// Explicit dates resolve to themselves, at midnight when no time is given.
const resolve = (timeRange: string): [string, string] => {
  if (SERVER[timeRange]) {
    return SERVER[timeRange];
  }
  const [since, until] = timeRange
    .split(' : ')
    .map(part => (part.length === 10 ? `${part}T00:00:00` : part));
  return [since, until];
};

const PRESETS = [
  'Last day',
  'Last week',
  'Last month',
  'Last quarter',
  'Last year',
  'previous calendar week',
  'previous calendar month',
  'previous calendar quarter',
  'previous calendar year',
  'Current day',
  'Current week',
  'Current month',
  'Current quarter',
  'Current year',
];

type TimeRangeItem = { timeRange: string; shift?: string };

const requestOf = (url: string): string | TimeRangeItem[] =>
  rison.decode(new URL(url).searchParams.get('q')!);

const timeRangeRequests = () =>
  fetchMock.callHistory
    .calls()
    .filter(call => call.url.includes('/api/v1/time_range/'))
    .map(call => requestOf(call.url));

const presetRequests = () =>
  timeRangeRequests().filter(
    request => Array.isArray(request) && request.length === PRESETS.length + 1,
  );

let holds: Record<string, Promise<void>> = {};
let draftHolds: Record<string, Promise<void>> = {};
let failPresets = false;

// Holds every check of `timeRange` until the returned function is called.
const hold = (timeRange: string) => {
  let release!: () => void;
  holds[timeRange] = new Promise<void>(done => {
    release = () => done();
  });
  return release;
};

// Like `hold`, but the presets list request still answers at once.
const holdDraft = (timeRange: string) => {
  let release!: () => void;
  draftHolds[timeRange] = new Promise<void>(done => {
    release = () => done();
  });
  return release;
};

// Every answered check has reached the picker.
const settled = () =>
  act(async () => {
    await fetchMock.callHistory.flush(true);
    await new Promise(done => setTimeout(done, 0));
  });

function mockServer() {
  fetchMock.get(
    'glob:*/api/v1/time_range/*',
    async ({ url }: { url: string }) => {
      const request = requestOf(url);
      const items =
        typeof request === 'string' ? [{ timeRange: request }] : request;
      if (failPresets && items.length === PRESETS.length + 1) {
        return { status: 500, body: { message: 'Server error' } };
      }
      await Promise.all(items.map(item => holds[item.timeRange]));
      if (items.length !== PRESETS.length + 1) {
        await Promise.all(items.map(item => draftHolds[item.timeRange]));
      }
      const results = items.map(({ timeRange }) => {
        const [since, until] = resolve(timeRange);
        return { since, until, timeRange, shift: null };
      });
      if (results.some(({ since, until }) => since && until && since > until)) {
        return { status: 400, body: { message: START_AFTER_END } };
      }
      return { result: results };
    },
  );
}

beforeAll(() => fetchMock.mockGlobal());
afterAll(() => fetchMock.hardReset());
afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  holds = {};
  draftHolds = {};
  failPresets = false;
});

const rule = (quantity: number, timeGrain: string) => ({
  quantity,
  time_grain: timeGrain,
});

const policy = (rules: Partial<Policy> = {}): Policy => ({
  max_span: null,
  max_look_back: null,
  max_look_forward: null,
  ...rules,
});

const POLICY_A = policy({
  max_span: rule(3, 'P1M'),
  max_look_back: rule(13, 'P1M'),
  max_look_forward: rule(0, 'P1D'),
});

const limitsOn = (
  rules: Policy = POLICY_A,
  source: Source = 'dashboard',
  extra: Partial<TimeRangeLimits> = {},
): TimeRangeLimits => ({ levels: [{ source, policy: rules }], ...extra });

function renderPicker(
  value: string,
  timeRangeLimits?: TimeRangeLimits,
  onChange = jest.fn(),
) {
  mockServer();
  render(
    <Provider store={mockStore({})}>
      <input aria-label="Other field" />
      <DateFilterLabel
        name="time_range"
        value={value}
        onChange={onChange}
        timeRangeLimits={timeRangeLimits}
      />
    </Provider>,
  );
  return onChange;
}

const trigger = () =>
  within(screen.getByTestId(DateFilterTestKey.PopoverOverlay)).getByRole(
    'button',
  );

async function openPicker() {
  await userEvent.click(trigger());
  await screen.findByText('Actual time range');
}

const applyButton = () => screen.getByRole('button', { name: 'Apply' });

const row = () => screen.getByText('Actual time range').parentElement!;

const rowAlert = () => within(row()).getByRole('alert');

const textboxes = () =>
  within(
    document.querySelector('.time-range-popover') as HTMLElement,
  ).getAllByRole('textbox');

const describedText = (element: HTMLElement) =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map(id => document.getElementById(id)?.textContent)
    .join(' | ');

async function chooseFrame(label: string) {
  await userEvent.click(screen.getByRole('combobox', { name: /^Range type/ }));
  const option = await waitFor(() =>
    within(
      document.querySelector('.ant-select-dropdown-list') as HTMLElement,
    ).getByText(label),
  );
  await userEvent.click(option);
}

const frameOptions = async () => {
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
  )
    .map(option => option.textContent)
    .sort();
};

const waitForCheck = () =>
  waitFor(() => expect(within(row()).getByText(/≤ col </)).toBeInTheDocument());

test('without the prop the picker is unchanged', async () => {
  renderPicker('Last week');
  await openPicker();

  expect(await frameOptions()).toEqual([
    'Advanced',
    'Current',
    'Custom',
    'Last',
    'No filter',
    'Previous',
  ]);
  await waitFor(() =>
    expect(mockedFetchTimeRange).toHaveBeenCalledWith(
      'Last week',
      'col',
      undefined,
      undefined,
    ),
  );
  expect(
    mockedFetchTimeRange.mock.calls.every(
      ([timeRange]) => timeRange === 'Last week',
    ),
  ).toBe(true);
  expect(timeRangeRequests()).toHaveLength(0);
  expect(screen.queryByText(/Limit on this/)).not.toBeInTheDocument();
});

test('levels with no rule leave the picker unchanged', async () => {
  renderPicker('Last week', {
    levels: [
      { source: 'global', policy: policy() },
      { source: 'dashboard', policy: null },
    ],
    dashboardId: 1,
  });
  await openPicker();

  expect(await frameOptions()).toContain('No filter');
  await waitFor(() =>
    expect(mockedFetchTimeRange).toHaveBeenCalledWith(
      'Last week',
      'col',
      undefined,
      undefined,
    ),
  );
  expect(
    mockedFetchTimeRange.mock.calls.every(
      ([timeRange]) => timeRange === 'Last week',
    ),
  ).toBe(true);
  expect(timeRangeRequests()).toHaveLength(0);
  expect(screen.queryByText(/limit/i)).not.toBeInTheDocument();
});

test('"No filter" is not offered', async () => {
  renderPicker('Last week', limitsOn());
  await openPicker();

  expect(await frameOptions()).toEqual([
    'Advanced',
    'Current',
    'Custom',
    'Last',
    'Previous',
  ]);
  expect(screen.queryByText('No filter')).not.toBeInTheDocument();
});

test('an applied "No filter" shows a placeholder and opens on Advanced, blocked', async () => {
  const onChange = renderPicker(
    NO_TIME_RANGE,
    limitsOn(POLICY_A, 'dashboard', { dashboardId: 7 }),
  );

  expect(trigger()).toHaveTextContent(
    "Select a time range within this dashboard's limits.",
  );
  expect(screen.queryByText('No filter')).not.toBeInTheDocument();

  await openPicker();
  expect(screen.getByText('Configure Advanced Time Range')).toBeInTheDocument();
  textboxes().forEach(input => expect(input).toHaveValue(''));
  await waitFor(() =>
    expect(rowAlert()).toHaveTextContent(
      'Choose a start and an end date. Time range limits are on.',
    ),
  );
  expect(
    screen.queryByText(/This chart requires a bounded time range/),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('No filter')).not.toBeInTheDocument();
  expect(applyButton()).toBeDisabled();
  await userEvent.click(applyButton());
  expect(onChange).not.toHaveBeenCalled();
});

test('without a dashboard the placeholder is the server text', async () => {
  renderPicker(NO_TIME_RANGE, limitsOn());

  expect(trigger()).toHaveTextContent(
    'Choose a start and an end date. Time range limits are on.',
  );
});

test('an open end asks for an end date under End', async () => {
  renderPicker('2025-01-01 : ', limitsOn());
  await openPicker();

  const [, end] = textboxes();
  await waitFor(() => expect(end).toHaveAttribute('aria-invalid', 'true'));
  expect(describedText(end)).toBe('An end date is required.');
  expect(applyButton()).toBeDisabled();
});

test('a span error shows in the range row in place of the range and marks the fields invalid', async () => {
  renderPicker('2025-01-01 : 2025-05-31', limitsOn());
  await openPicker();

  await waitFor(() =>
    expect(rowAlert()).toHaveTextContent(
      /^Range can't be longer than 3 months\. This one is 4 months and 30 days\.$/,
    ),
  );
  expect(within(row()).queryByText(/≤ col </)).not.toBeInTheDocument();
  expect(applyButton()).toBeDisabled();
  textboxes().forEach(input =>
    expect(input).toHaveAttribute('aria-invalid', 'true'),
  );
  expect(describedText(textboxes()[0])).toContain("Range can't be longer");
});

test('a look-back error shows under Custom Start', async () => {
  renderPicker(
    '2024-01-01T00:00:00 : 2025-05-31T00:00:00',
    limitsOn(policy({ max_look_back: rule(13, 'P1M') })),
  );
  await openPicker();

  const startMode = await screen.findByRole('combobox', {
    name: /^Start \(inclusive\)/,
  });
  await waitFor(() =>
    expect(startMode).toHaveAttribute('aria-invalid', 'true'),
  );
  const message = document.getElementById(
    startMode.getAttribute('aria-describedby')!,
  )!;
  expect(message).toHaveAttribute('role', 'alert');
  expect(message).toHaveTextContent(
    /^Start can't be earlier than Apr 30, 2024 \(13 months ago\)\.$/,
  );
  const [startDate, endDate] = screen.getAllByPlaceholderText('Select date');
  expect(startDate).toHaveAttribute('aria-invalid', 'true');
  expect(startDate).toHaveAttribute('aria-describedby', message.id);
  expect(endDate).not.toHaveAttribute('aria-invalid', 'true');
  expect(within(row()).queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getAllByRole('alert')).toHaveLength(1);
});

test('a look-forward error shows under Advanced End', async () => {
  renderPicker('2025-05-01 : 2025-06-02', limitsOn());
  await openPicker();

  const [start, end] = textboxes();
  await waitFor(() => expect(end).toHaveAttribute('aria-invalid', 'true'));
  expect(describedText(end)).toBe("End can't be later than today.");
  expect(start).not.toHaveAttribute('aria-invalid');
  expect(within(row()).queryByRole('alert')).not.toBeInTheDocument();
});

test('a field is not marked invalid while the check of its new value is pending', async () => {
  renderPicker('2025-05-01 : 2025-06-02', limitsOn());
  await openPicker();
  const [, end] = textboxes();
  await waitFor(() => expect(end).toHaveAttribute('aria-invalid', 'true'));

  const release = hold('2025-05-01 : 2025-05-31');
  await userEvent.clear(end);
  await userEvent.type(end, '2025-05-31');
  expect(applyButton()).toBeDisabled();
  expect(end).not.toHaveAttribute('aria-invalid');
  expect(end).not.toHaveAttribute('aria-describedby');

  await waitFor(() =>
    expect(
      timeRangeRequests().some(
        request =>
          Array.isArray(request) &&
          request[0].timeRange === '2025-05-01 : 2025-05-31',
      ),
    ).toBe(true),
  );
  expect(applyButton()).toBeDisabled();
  expect(end).not.toHaveAttribute('aria-invalid');
  expect(end).not.toHaveAttribute('aria-describedby');

  release();
  await waitFor(() => expect(applyButton()).toBeEnabled(), { timeout: 5000 });
  expect(end).not.toHaveAttribute('aria-invalid');
  expect(end).not.toHaveAttribute('aria-describedby');
});

test('two failures, the span in the row and the look-back under Start, with no summary line', async () => {
  renderPicker('2024-02-28 : 2024-05-31', limitsOn());
  await openPicker();

  await waitFor(() =>
    expect(rowAlert()).toHaveTextContent(
      /^Range can't be longer than 3 months\. This one is 3 months and 1 day\.$/,
    ),
  );
  expect(screen.queryByText(/Range not applied/)).not.toBeInTheDocument();
  const [start] = textboxes();
  expect(start).toHaveAttribute('aria-invalid', 'true');
  expect(describedText(start)).toBe(
    "Start can't be earlier than Apr 30, 2024 (13 months ago). | Range can't be longer than 3 months. This one is 3 months and 1 day.",
  );
});

test.each(['dashboard', 'dataset', 'global'] as Source[])(
  'a failure from the %s level shows no level sentence',
  async source => {
    renderPicker('2025-01-01 : 2025-05-31', limitsOn(POLICY_A, source));
    await openPicker();

    await waitFor(() =>
      expect(rowAlert()).toHaveTextContent(
        /^Range can't be longer than 3 months\. This one is 4 months and 30 days\.$/,
      ),
    );
  },
);

test('an open range names no level', async () => {
  renderPicker(' : ', limitsOn());
  await openPicker();

  await waitFor(() =>
    expect(rowAlert()).toHaveTextContent(
      'Choose a start and an end date. Time range limits are on.',
    ),
  );
});

test('Apply waits for the check of the current draft and ignores late answers', async () => {
  const onChange = renderPicker('2025-03-01 : 2025-05-31', limitsOn());
  await openPicker();
  await waitFor(() => expect(applyButton()).toBeEnabled(), { timeout: 5000 });

  const release = hold('2025-01-01 : 2025-05-31');
  const [start] = textboxes();
  await userEvent.clear(start);
  await userEvent.type(start, '2025-01-01');
  expect(applyButton()).toBeDisabled();
  await waitFor(() =>
    expect(
      timeRangeRequests().some(
        request =>
          Array.isArray(request) &&
          request[0].timeRange === '2025-01-01 : 2025-05-31',
      ),
    ).toBe(true),
  );

  await userEvent.clear(start);
  await userEvent.type(start, '2025-04-01');
  expect(applyButton()).toBeDisabled();
  await waitFor(() => expect(applyButton()).toBeEnabled(), { timeout: 5000 });
  await waitFor(() =>
    expect(
      within(row()).getByText('2025-04-01 ≤ col < 2025-05-31'),
    ).toBeVisible(),
  );

  release();
  await settled();
  expect(applyButton()).toBeEnabled();
  expect(within(row()).queryByRole('alert')).not.toBeInTheDocument();
  await waitFor(() =>
    expect(
      within(row()).getByText('2025-04-01 ≤ col < 2025-05-31'),
    ).toBeVisible(),
  );

  await userEvent.click(applyButton());
  expect(onChange).toHaveBeenCalledWith('2025-04-01 : 2025-05-31');
});

test('a 400 shows its message in the row, also for the applied value', async () => {
  renderPicker('2025-06-01 : 2025-05-01', limitsOn());
  const checksOfValue = () =>
    timeRangeRequests().filter(
      request =>
        Array.isArray(request) &&
        request.length === 2 &&
        request[0].timeRange === '2025-06-01 : 2025-05-01',
    ).length;
  await waitFor(() => expect(checksOfValue()).toBeGreaterThan(0));
  expect(timeRangeRequests()).not.toContain('2025-06-01 : 2025-05-01');
  await settled();
  const onMount = checksOfValue();

  await openPicker();
  expect(rowAlert()).toHaveTextContent(START_AFTER_END);
  expect(applyButton()).toBeDisabled();
  await waitFor(() => expect(checksOfValue()).toBe(onMount + 1));
  expect(rowAlert()).toHaveTextContent(START_AFTER_END);
  expect(applyButton()).toBeDisabled();
});

test('a 400 for the applied value shows in the row while the open check is pending', async () => {
  renderPicker('2025-06-01 : 2025-05-01', limitsOn());
  const checksOfValue = () =>
    timeRangeRequests().filter(
      request =>
        Array.isArray(request) &&
        request.length === 2 &&
        request[0].timeRange === '2025-06-01 : 2025-05-01',
    ).length;
  await waitFor(() => expect(checksOfValue()).toBeGreaterThan(0));
  await settled();
  const onMount = checksOfValue();

  const release = hold('2025-06-01 : 2025-05-01');
  await openPicker();
  expect(checksOfValue()).toBe(onMount + 1);
  expect(rowAlert()).toHaveTextContent(new RegExp(`^${START_AFTER_END}$`));
  expect(applyButton()).toBeDisabled();

  release();
  await settled();
  expect(rowAlert()).toHaveTextContent(new RegExp(`^${START_AFTER_END}$`));
  expect(applyButton()).toBeDisabled();
});

test('the limit line sits under the range, with the time zone', async () => {
  renderPicker(
    'Last week',
    limitsOn(POLICY_A, 'dashboard', { timezone: 'Europe/Warsaw' }),
  );
  await openPicker();
  await waitForCheck();

  expect(
    within(row()).getByText(
      'Limit on this dashboard: up to 3 months, within the last 13 months, no future dates. Times in Europe/Warsaw.',
    ),
  ).toBeInTheDocument();
});

test('the limit line of policy A', async () => {
  renderPicker('Last week', limitsOn());
  await openPicker();
  await waitForCheck();

  expect(
    within(row()).getByText(
      'Limit on this dashboard: up to 3 months, within the last 13 months, no future dates.',
    ),
  ).toBeInTheDocument();
});

test('a timed-out check shows the could-not-be-checked text and keeps Apply disabled', async () => {
  const get = jest.spyOn(SupersetClient, 'get').mockRejectedValue({
    error: 'Request timed out',
    statusText: 'timeout',
    timeout: 10000,
  });
  renderPicker('Last week', limitsOn());
  await openPicker();

  await waitFor(() =>
    expect(rowAlert()).toHaveTextContent('Time range could not be checked.'),
  );
  expect(applyButton()).toBeDisabled();
  expect(get).toHaveBeenCalled();
  get.mock.calls.forEach(([request]) =>
    expect(request).toMatchObject({
      timeout: 10000,
      fetchRetryOptions: { retries: 0 },
    }),
  );
  get.mockRestore();
});

test('a failed applied check replaces the previous range in the trigger and marks it invalid', async () => {
  const realGet = SupersetClient.get.bind(SupersetClient);
  let down = false;
  const get = jest
    .spyOn(SupersetClient, 'get')
    .mockImplementation(request =>
      down
        ? Promise.reject({ error: 'Request timed out', statusText: 'timeout' })
        : realGet(request),
    );
  mockServer();
  const element = (value: string) => (
    <Provider store={mockStore({})}>
      <DateFilterLabel
        name="time_range"
        value={value}
        onChange={jest.fn()}
        timeRangeLimits={limitsOn()}
      />
    </Provider>
  );
  const { rerender } = render(element('2025-05-20 : 2025-05-25'));
  await waitFor(() =>
    expect(trigger()).toHaveTextContent('2025-05-20 ≤ col < 2025-05-25'),
  );
  expect(trigger()).not.toHaveAttribute('aria-invalid');

  down = true;
  rerender(element('2025-05-10 : 2025-05-15'));

  await waitFor(() =>
    expect(trigger()).toHaveAttribute('aria-invalid', 'true'),
  );
  expect(trigger()).not.toHaveTextContent('2025-05-20 ≤ col < 2025-05-25');
  get.mockRestore();
});

test.each([
  ['a timed-out check', '2025-05-20 : 2025-05-25', true],
  ['a rejected expression', '2025-05-25 : 2025-05-20', false],
])('the trigger is aria-invalid after %s', async (_, value, timedOut) => {
  const get = timedOut
    ? jest.spyOn(SupersetClient, 'get').mockRejectedValue({
        error: 'Request timed out',
        statusText: 'timeout',
      })
    : undefined;
  renderPicker(value, limitsOn());

  await waitFor(() =>
    expect(trigger()).toHaveAttribute('aria-invalid', 'true'),
  );
  get?.mockRestore();
});

test('one preset call per open resolves the 14 presets and the clock', async () => {
  renderPicker('Last week', limitsOn());
  await openPicker();
  await waitFor(() => expect(presetRequests()).toHaveLength(1));

  expect(presetRequests()).toEqual([
    [...PRESETS, 'today : now'].map(timeRange => ({ timeRange })),
  ]);

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await openPicker();
  await waitFor(() => expect(presetRequests()).toHaveLength(2));
});

test('Last options that break the limits are disabled with their reason', async () => {
  renderPicker('Last week', limitsOn());
  await openPicker();

  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'Last year' })).toBeDisabled(),
  );
  ['Last day', 'Last week', 'Last month', 'Last quarter'].forEach(name =>
    expect(screen.getByRole('radio', { name })).toBeEnabled(),
  );
  await userEvent.hover(screen.getByText('Last year'));
  expect(
    await screen.findByText(
      "Range can't be longer than 3 months. This one is 12 months.",
    ),
  ).toBeInTheDocument();
}, 30000);

test('Previous options that break the limits are disabled', async () => {
  renderPicker('previous calendar week', limitsOn());
  await openPicker();

  await waitFor(() =>
    expect(
      screen.getByRole('radio', { name: 'previous calendar year' }),
    ).toBeDisabled(),
  );
  [
    'previous calendar week',
    'previous calendar month',
    'previous calendar quarter',
  ].forEach(name => expect(screen.getByRole('radio', { name })).toBeEnabled());
}, 30000);

test('switching to Current picks the first allowed option', async () => {
  renderPicker('Last week', limitsOn());
  await openPicker();
  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'Last year' })).toBeDisabled(),
  );

  await chooseFrame('Current');
  expect(
    await screen.findByRole('radio', { name: 'Current day' }),
  ).toBeChecked();
  ['Current week', 'Current quarter', 'Current year'].forEach(name =>
    expect(screen.getByRole('radio', { name })).toBeDisabled(),
  );
  ['Current day', 'Current month'].forEach(name =>
    expect(screen.getByRole('radio', { name })).toBeEnabled(),
  );
}, 30000);

test('switching to Last keeps "Last week" when it fits', async () => {
  renderPicker('2025-03-01 : 2025-05-31', limitsOn());
  await openPicker();
  await waitFor(() => expect(presetRequests()).toHaveLength(1));
  await waitFor(() => expect(applyButton()).toBeEnabled(), { timeout: 5000 });

  await chooseFrame('Last');
  expect(await screen.findByRole('radio', { name: 'Last week' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Last day' })).not.toBeChecked();
  expect(screen.getByRole('radio', { name: 'Last year' })).toBeDisabled();
}, 30000);

test('an applied preset that breaks the limits stays checked and enabled', async () => {
  renderPicker('Current quarter', limitsOn());
  await openPicker();
  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'Current year' })).toBeDisabled(),
  );

  const quarter = screen.getByRole('radio', { name: 'Current quarter' });
  expect(quarter).toBeChecked();
  expect(quarter).toBeEnabled();
  await waitFor(() =>
    expect(rowAlert()).toHaveTextContent(/^End can't be later than today\.$/),
  );
  expect(quarter).toHaveAttribute('aria-invalid', 'true');
  expect(quarter).toHaveAttribute(
    'aria-describedby',
    rowAlert().getAttribute('id'),
  );
}, 30000);

test('picking an allowed preset clears the aria of every radio', async () => {
  renderPicker('Current quarter', limitsOn());
  await openPicker();
  const quarter = screen.getByRole('radio', { name: 'Current quarter' });
  await waitFor(() => expect(quarter).toHaveAttribute('aria-invalid', 'true'));

  await userEvent.click(screen.getByRole('radio', { name: 'Current day' }));
  await waitFor(() => expect(applyButton()).toBeEnabled(), { timeout: 5000 });
  expect(within(row()).queryByRole('alert')).not.toBeInTheDocument();
  screen.getAllByRole('radio').forEach(radio => {
    expect(radio).not.toHaveAttribute('aria-invalid');
    expect(radio).not.toHaveAttribute('aria-describedby');
  });
}, 30000);

test('a newly checked preset is not marked invalid while its check is pending', async () => {
  renderPicker('Current quarter', limitsOn());
  await openPicker();
  const quarter = screen.getByRole('radio', { name: 'Current quarter' });
  await waitFor(() => expect(quarter).toHaveAttribute('aria-invalid', 'true'));

  const release = holdDraft('Current day');
  const day = screen.getByRole('radio', { name: 'Current day' });
  await userEvent.click(day);
  expect(day).toBeChecked();
  expect(applyButton()).toBeDisabled();
  expect(day).not.toHaveAttribute('aria-invalid');
  expect(day).not.toHaveAttribute('aria-describedby');

  await waitFor(() =>
    expect(
      timeRangeRequests().some(
        request =>
          Array.isArray(request) && request[0].timeRange === 'Current day',
      ),
    ).toBe(true),
  );
  expect(applyButton()).toBeDisabled();
  expect(rowAlert()).toHaveTextContent(/^End can't be later than today\.$/);
  expect(day).not.toHaveAttribute('aria-invalid');
  expect(day).not.toHaveAttribute('aria-describedby');

  release();
  await waitFor(() => expect(applyButton()).toBeEnabled(), { timeout: 5000 });
  expect(day).not.toHaveAttribute('aria-invalid');
  expect(day).not.toHaveAttribute('aria-describedby');
}, 30000);

test('when the preset call fails nothing is disabled', async () => {
  failPresets = true;
  renderPicker('Last week', limitsOn());
  await openPicker();
  await waitFor(() => expect(presetRequests()).toHaveLength(1));
  await waitForCheck();

  screen.getAllByRole('radio').forEach(radio => expect(radio).toBeEnabled());
});

const onDashboard = (
  rules: Policy = POLICY_A,
  extra: Partial<TimeRangeLimits> = {},
) => limitsOn(rules, 'global', { dashboardId: 7, ...extra });

const HINT = "No filter isn't offered while time range limits are on.";

test('on a dashboard the limit line says "Limit on this dashboard" with no full stop, the time zone on its own line', async () => {
  renderPicker('Last week', onDashboard(POLICY_A, { timezone: 'CET' }));
  await openPicker();
  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'Last year' })).toBeDisabled(),
  );
  await waitForCheck();

  const group = screen.getByRole('radiogroup', {
    name: 'Configure Time Range: Last...',
  });
  await waitFor(() =>
    expect(group.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2),
  );
  const limitLine = document.getElementById(
    group.getAttribute('aria-describedby')!.split(' ')[1],
  )!;
  expect(
    Array.from(limitLine.children).map(child => child.textContent),
  ).toEqual([
    'Limit on this dashboard: up to 3 months, within the last 13 months, no future dates',
    'Times in CET.',
  ]);
}, 30000);

test('outside a dashboard the limit line keeps its level prefix, full stop and time zone', async () => {
  renderPicker('Last week', limitsOn(POLICY_A, 'global', { timezone: 'CET' }));
  await openPicker();
  await waitForCheck();

  expect(
    within(row()).getByText(
      'Admin limit: up to 3 months, within the last 13 months, no future dates. Times in CET.',
    ),
  ).toBeInTheDocument();
});

test('the hint under Range type shows on a dashboard only', async () => {
  renderPicker('Last week', onDashboard());
  await openPicker();

  const hint = screen.getByText(HINT);
  expect(
    screen
      .getByRole('combobox', { name: /^Range type/ })
      .compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test('no hint outside a dashboard or with limits off', async () => {
  renderPicker('Last week', limitsOn());
  await openPicker();
  expect(screen.queryByText(HINT)).not.toBeInTheDocument();
});

test('limits off on a dashboard keep the default picker', async () => {
  mockedFetchTimeRange.mockResolvedValue({ value: '2023-01-01 ≤ col < ∞' });
  renderPicker('2023-01-01 : ', {
    levels: [{ source: 'global', policy: policy() }],
    dashboardId: 7,
  });
  await openPicker();

  expect(await frameOptions()).toContain('No filter');
  await waitFor(() =>
    expect(within(row()).getByText('2023-01-01 ≤ col < ∞')).toBeVisible(),
  );
  expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  expect(screen.queryByText(/Limit on this/)).not.toBeInTheDocument();
  expect(screen.queryByText(/End is required/)).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a disabled Last option on a dashboard says why in a tooltip, to the right', async () => {
  renderPicker('Last week', onDashboard());
  await openPicker();
  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'Last year' })).toBeDisabled(),
  );

  await userEvent.hover(screen.getByText('Last year'));
  const tip = await screen.findByText(
    'Longer than this dashboard allows (3 months)',
  );
  expect(tip.closest('.ant-tooltip')).toHaveClass(
    'ant-tooltip-placement-right',
  );
}, 30000);

test('a disabled Previous or Current option on a dashboard gives its length, one reason only', async () => {
  renderPicker('previous calendar week', onDashboard());
  await openPicker();
  await waitFor(() =>
    expect(
      screen.getByRole('radio', { name: 'previous calendar year' }),
    ).toBeDisabled(),
  );

  await userEvent.hover(screen.getByText('previous calendar year'));
  const tip = await screen.findByText(
    '12 months, longer than this dashboard allows (3 months)',
  );
  expect(tip).toHaveTextContent(
    /^12 months, longer than this dashboard allows \(3 months\)$/,
  );
  expect(screen.queryByText(/Start can't be earlier/)).not.toBeInTheDocument();

  await chooseFrame('Current');
  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'Current year' })).toBeDisabled(),
  );
  await userEvent.hover(screen.getByText('Current year'));
  expect(
    await screen.findByText(
      '12 months, longer than this dashboard allows (3 months)',
    ),
  ).toBeInTheDocument();
}, 30000);

test('outside a dashboard a disabled option gives its first failure only', async () => {
  renderPicker('previous calendar week', limitsOn());
  await openPicker();
  await waitFor(() =>
    expect(
      screen.getByRole('radio', { name: 'previous calendar year' }),
    ).toBeDisabled(),
  );

  await userEvent.hover(screen.getByText('previous calendar year'));
  const tip = await screen.findByText(/^Range can't be longer than 3 months/);
  expect(tip).toHaveTextContent(
    /^Range can't be longer than 3 months\. This one is 12 months\.$/,
  );
}, 30000);

test('a blank end on a dashboard says "End is required on this dashboard"', async () => {
  renderPicker('2025-01-01 : ', onDashboard());
  await openPicker();

  const [, end] = textboxes();
  await waitFor(() => expect(end).toHaveAttribute('aria-invalid', 'true'));
  expect(describedText(end)).toBe('End is required on this dashboard');
  await waitFor(() =>
    expect(within(row()).getByText('2025-01-01 ≤ col < ∞')).toBeVisible(),
  );
});

test('both ends blank keep "-∞ ≤ col < ∞" and the server text', async () => {
  renderPicker(' : ', onDashboard());
  await openPicker();

  await waitFor(() =>
    expect(rowAlert()).toHaveTextContent(
      'Choose a start and an end date. Time range limits are on.',
    ),
  );
  await waitFor(() =>
    expect(within(row()).getByText('-∞ ≤ col < ∞')).toBeVisible(),
  );
});

test('the range stays for a look-forward error', async () => {
  renderPicker('2025-05-01 : 2025-06-02', onDashboard());
  await openPicker();

  await waitFor(() =>
    expect(textboxes()[1]).toHaveAttribute('aria-invalid', 'true'),
  );
  await waitFor(() =>
    expect(
      within(row()).getByText('2025-05-01 ≤ col < 2025-06-02'),
    ).toBeVisible(),
  );
});

test('Custom greys out the days the limits rule out', async () => {
  renderPicker('2025-03-01T00:00:00 : 2025-05-31T00:00:00', limitsOn());
  await openPicker();
  await waitForCheck();

  const [startDate, endDate] = screen.getAllByPlaceholderText('Select date');
  await userEvent.click(startDate);
  await waitFor(() =>
    expect(document.querySelector('td[title="2025-02-28"]')).not.toHaveClass(
      'ant-picker-cell-disabled',
    ),
  );
  expect(document.querySelector('td[title="2025-03-01"]')).not.toHaveClass(
    'ant-picker-cell-disabled',
  );

  await userEvent.click(endDate);
  const endCell = (day: string) =>
    Array.from(document.querySelectorAll(`td[title="${day}"]`)).pop();
  await waitFor(() =>
    expect(endCell('2025-06-02')).toHaveClass('ant-picker-cell-disabled'),
  );
  expect(endCell('2025-06-01')).not.toHaveClass('ant-picker-cell-disabled');
});

test('with limits on, the trigger and the "Actual time range" line use displayFormat', async () => {
  mockServer();
  render(
    <Provider store={mockStore({})}>
      <DateFilterLabel
        name="time_range"
        value="2025-05-01 : 2025-05-31"
        onChange={jest.fn()}
        displayFormat="%d-%m-%Y"
        timeRangeLimits={limitsOn()}
      />
    </Provider>,
  );

  await waitFor(() =>
    expect(trigger()).toHaveTextContent('01-05-2025 ≤ col < 31-05-2025'),
  );
  await openPicker();
  await waitFor(() =>
    expect(
      within(row()).getByText('01-05-2025 ≤ col < 31-05-2025'),
    ).toBeVisible(),
  );
  expect(mockedFetchTimeRange).not.toHaveBeenCalled();
});

test('near midnight a "Specific Date/Time" Start defaults to the browser day, which a "today" look-back rules out', async () => {
  // 20:00 on Jan 1 in the browser (America/New_York), 01:00 on Jan 2 on a
  // UTC server: master's local-time default opens on the browser's day.
  jest.useFakeTimers({
    now: new Date('2025-01-02T01:00:00Z'),
    advanceTimers: true,
  });
  const serverPart = (part: string) => {
    if (part === 'now') return '2025-01-02T01:00:00';
    if (part === 'today') return '2025-01-02T00:00:00';
    if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return `${part}T00:00:00`;
    if (/^\d{4}-\d{2}-\d{2}T/.test(part)) return part;
    return '2025-01-01T00:00:00';
  };
  fetchMock.get('glob:*/api/v1/time_range/*', ({ url }: { url: string }) => {
    const request = requestOf(url);
    const items =
      typeof request === 'string' ? [{ timeRange: request }] : request;
    return {
      result: items.map(({ timeRange }) => {
        const [since, until] = timeRange.split(' : ').map(serverPart);
        return { since, until, timeRange, shift: null };
      }),
    };
  });
  render(
    <Provider store={mockStore({})}>
      <DateFilterLabel
        name="time_range"
        value="today : now"
        onChange={jest.fn()}
        timeRangeLimits={limitsOn(
          policy({
            max_look_back: rule(0, 'P1D'),
            max_look_forward: rule(0, 'P1D'),
          }),
        )}
      />
    </Provider>,
  );
  await openPicker();
  await waitFor(() => expect(applyButton()).toBeEnabled());

  const startMode = screen.getByRole('combobox', {
    name: /^Start \(inclusive\)/,
  });
  await userEvent.click(startMode);
  await userEvent.click(
    await waitFor(() =>
      within(
        document.querySelector('.ant-select-dropdown-list') as HTMLElement,
      ).getByText('Specific Date/Time'),
    ),
  );

  await waitFor(() =>
    expect(startMode).toHaveAttribute('aria-invalid', 'true'),
  );
  expect(describedText(startMode)).toBe("Start can't be earlier than today.");
  expect(applyButton()).toBeDisabled();

  const [startDate] = screen.getAllByPlaceholderText('Select date');
  expect(startDate).toHaveValue('2025-01-01 00:00:00');
  await userEvent.click(startDate);
  await waitFor(() =>
    expect(document.querySelector('td[title="2025-01-01"]')).toHaveClass(
      'ant-picker-cell-disabled',
    ),
  );
  expect(document.querySelector('td[title="2025-01-02"]')).not.toHaveClass(
    'ant-picker-cell-disabled',
  );
});

test('an unknown time grain blocks Apply and says range could not be checked', async () => {
  renderPicker('Last week', limitsOn(policy({ max_span: rule(1, 'P1Q') })));
  await openPicker();

  await waitFor(() =>
    expect(rowAlert()).toHaveTextContent('Time range could not be checked.'),
  );
  expect(applyButton()).toBeDisabled();
});

const waitForTriggerFocus = () =>
  waitFor(() => expect(trigger()).toHaveFocus());

const contentGone = () =>
  waitFor(() =>
    expect(
      document.querySelector('.time-range-popover'),
    ).not.toBeInTheDocument(),
  );

test('Cancel, Apply and Escape give focus back to the trigger', async () => {
  renderPicker('Last week', limitsOn());

  await openPicker();
  screen.getByRole('radio', { name: 'Last month' }).focus();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await contentGone();
  await waitForTriggerFocus();

  await openPicker();
  await userEvent.click(screen.getByRole('radio', { name: 'Last month' }));
  await waitFor(() => expect(applyButton()).toBeEnabled(), { timeout: 5000 });
  await userEvent.click(applyButton());
  await contentGone();
  await waitForTriggerFocus();

  await openPicker();
  screen.getByRole('radio', { name: 'Last week' }).focus();
  await userEvent.type(document.activeElement!, '{Escape}', {
    skipClick: true,
  });
  await contentGone();
  await waitForTriggerFocus();
}, 30000);

test('Cancel after an invalid draft keeps the applied value, closes the picker and gives focus back', async () => {
  const onChange = renderPicker('2025-03-01 : 2025-05-31', limitsOn());
  await openPicker();
  await waitFor(() => expect(applyButton()).toBeEnabled(), { timeout: 5000 });
  const applied = trigger().textContent;
  expect(applied).toContain('2025-03-01 ≤ col < 2025-05-31');

  const [start] = textboxes();
  await userEvent.clear(start);
  await userEvent.type(start, '2023-01-01');
  await waitFor(() => expect(start).toHaveAttribute('aria-invalid', 'true'), {
    timeout: 5000,
  });
  expect(applyButton()).toBeDisabled();

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await contentGone();
  await waitForTriggerFocus();
  expect(onChange).not.toHaveBeenCalled();
  expect(trigger()).toHaveTextContent(applied!);

  await openPicker();
  expect(textboxes()[0]).toHaveValue('2025-03-01');
}, 30000);

test('an outside click gives focus back only when it fell on the page', async () => {
  renderPicker('Last week', limitsOn());

  await openPicker();
  screen.getByRole('radio', { name: 'Last week' }).focus();
  await userEvent.click(document.body);
  await contentGone();
  await waitForTriggerFocus();

  await openPicker();
  screen.getByRole('radio', { name: 'Last week' }).focus();
  await userEvent.click(screen.getByLabelText('Other field'));
  await contentGone();
  expect(screen.getByLabelText('Other field')).toHaveFocus();
}, 30000);

test('Enter in an Advanced field while invalid moves focus to the first invalid field', async () => {
  renderPicker('2025-03-01 : 2025-05-31', limitsOn());
  await openPicker();
  await waitFor(() => expect(applyButton()).toBeEnabled(), { timeout: 5000 });
  const [start, end] = textboxes();

  await userEvent.clear(end);
  await userEvent.type(end, '2025-06-02');
  await waitFor(() => expect(end).toHaveAttribute('aria-invalid', 'true'), {
    timeout: 5000,
  });
  expect(end).toHaveFocus();

  await userEvent.type(start, '{Enter}');
  expect(end).toHaveFocus();
});

test('Enter with only a span error focuses Advanced Start', async () => {
  renderPicker('2025-01-01 : 2025-05-31', limitsOn());
  await openPicker();
  await waitFor(() => expect(rowAlert()).toBeInTheDocument());
  const [start, end] = textboxes();

  end.focus();
  await userEvent.type(end, '{Enter}', { skipClick: true });
  expect(start).toHaveFocus();
});

test('Enter on a radio while invalid focuses the checked option', async () => {
  renderPicker('Current quarter', limitsOn());
  await openPicker();
  await waitFor(() => expect(rowAlert()).toBeInTheDocument());
  const quarter = screen.getByRole('radio', { name: 'Current quarter' });
  const day = screen.getByRole('radio', { name: 'Current day' });

  day.focus();
  await userEvent.type(day, '{Enter}', { skipClick: true });
  expect(quarter).toBeChecked();
  expect(quarter).toHaveFocus();
});

test('Enter from the Range type or a date picker, while valid or pending, moves nothing', async () => {
  renderPicker('2025-03-01 : 2025-05-31', limitsOn());
  await openPicker();
  await waitFor(() => expect(applyButton()).toBeEnabled(), { timeout: 5000 });
  const [start, end] = textboxes();

  end.focus();
  await userEvent.type(end, '{Enter}', { skipClick: true });
  expect(end).toHaveFocus();

  const release = hold('2025-01-01 : 2025-05-31');
  await userEvent.clear(start);
  await userEvent.type(start, '2025-01-01');
  await userEvent.type(end, '{Enter}');
  expect(end).toHaveFocus();
  await waitFor(() =>
    expect(
      timeRangeRequests().some(
        request =>
          Array.isArray(request) &&
          request[0].timeRange === '2025-01-01 : 2025-05-31',
      ),
    ).toBe(true),
  );
  await userEvent.type(end, '{Enter}', { skipClick: true });
  expect(end).toHaveFocus();
  release();
  await waitFor(() => expect(rowAlert()).toBeInTheDocument(), {
    timeout: 5000,
  });
  expect(end).toHaveFocus();

  const rangeType = screen.getByRole('combobox', { name: /^Range type/ });
  rangeType.focus();
  await userEvent.type(rangeType, '{Enter}', { skipClick: true });
  expect(rangeType).toHaveFocus();
});

test('Enter in a Custom date picker moves nothing', async () => {
  renderPicker('2025-01-01T00:00:00 : 2025-05-31T00:00:00', limitsOn());
  await openPicker();
  const startMode = await screen.findByRole('combobox', {
    name: /^Start \(inclusive\)/,
  });
  await waitFor(() => expect(startMode).toHaveFocus());

  const [, endDate] = screen.getAllByPlaceholderText('Select date');
  endDate.focus();
  await userEvent.type(endDate, '{Enter}', { skipClick: true });
  expect(endDate).toHaveFocus();
});

test('Enter on the Custom End mode while invalid moves nothing', async () => {
  renderPicker('2025-01-01T00:00:00 : 2025-05-31T00:00:00', limitsOn());
  await openPicker();
  const startMode = await screen.findByRole('combobox', {
    name: /^Start \(inclusive\)/,
  });
  await waitFor(() => expect(startMode).toHaveFocus());
  expect(applyButton()).toBeDisabled();

  const endMode = screen.getByRole('combobox', { name: /^End \(exclusive\)/ });
  endMode.focus();
  await userEvent.type(endMode, '{Enter}', { skipClick: true });
  expect(endMode).toHaveFocus();
});

test('typing never moves focus', async () => {
  renderPicker('2025-03-01 : 2025-05-31', limitsOn());
  await openPicker();
  await waitFor(() => expect(applyButton()).toBeEnabled(), { timeout: 5000 });
  const [start] = textboxes();

  await userEvent.clear(start);
  await userEvent.type(start, '2024-01-01');
  await waitFor(() => expect(start).toHaveAttribute('aria-invalid', 'true'), {
    timeout: 5000,
  });
  expect(start).toHaveFocus();
});

test('opening on "No filter" focuses Advanced Start', async () => {
  renderPicker(NO_TIME_RANGE, limitsOn());
  await openPicker();

  await waitFor(() => expect(textboxes()[0]).toHaveFocus(), {
    timeout: 5000,
  });
});

test('opening on a Custom range with a span error focuses the Start mode', async () => {
  renderPicker(
    '2025-01-01T00:00:00 : 2025-05-31T00:00:00',
    limitsOn(policy({ max_span: rule(3, 'P1M') })),
  );
  await openPicker();

  const startMode = await screen.findByRole('combobox', {
    name: /^Start \(inclusive\)/,
  });
  await waitFor(() => expect(startMode).toHaveFocus());
});

test('opening on an invalid value focuses its first invalid field once', async () => {
  renderPicker('2025-05-01 : 2025-06-02', limitsOn());
  await openPicker();
  const [start, end] = textboxes();

  await waitFor(() => expect(end).toHaveFocus());
  start.focus();
  await settled();
  expect(start).toHaveFocus();
});

test('typing before the first check cancels the focus on open', async () => {
  const release = hold('2025-05-01 : 2025-06-02');
  renderPicker('2025-05-01 : 2025-06-02', limitsOn());
  await openPicker();
  const [start, end] = textboxes();

  start.focus();
  await userEvent.type(start, '{Backspace}2025-05-02', {
    skipClick: true,
    initialSelectionStart: 0,
    initialSelectionEnd: (start as HTMLInputElement).value.length,
  });
  await waitFor(() => expect(end).toHaveAttribute('aria-invalid', 'true'), {
    timeout: 5000,
  });
  expect(start).toHaveValue('2025-05-02');
  release();
  await settled();
  expect(start).toHaveFocus();
}, 30000);

test('a frame switch before the first check cancels the focus on open', async () => {
  const release = hold('2025-05-01 : 2025-06-02');
  failPresets = true;
  renderPicker('2025-05-01 : 2025-06-02', limitsOn());
  await openPicker();

  const rangeType = screen.getByRole('combobox', { name: /^Range type/ });
  fireEvent.change(rangeType, { target: { value: 'Current' } });
  const option = await waitFor(() =>
    within(
      document.querySelector('.ant-select-dropdown-list') as HTMLElement,
    ).getByText('Current'),
  );
  fireEvent.click(option);
  const week = await screen.findByRole('radio', { name: 'Current week' });
  expect(week).toBeChecked();
  const focused = document.activeElement as HTMLElement;

  await waitFor(
    () =>
      expect(rowAlert()).toHaveTextContent(/^End can't be later than today\.$/),
    { timeout: 5000 },
  );
  await waitFor(() => expect(week).toHaveAttribute('aria-invalid', 'true'));
  release();
  await settled();
  expect(week).not.toHaveFocus();
  expect(focused).toHaveFocus();
}, 30000);

test('opening on a preset that breaks the limits focuses it', async () => {
  renderPicker('Last year', limitsOn());
  await openPicker();

  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'Last year' })).toHaveFocus(),
  );
});

/*
 * Accessibility with time range limits on. Without limits the
 * picker stays unchanged.
 */

const popoverRoot = () =>
  document.querySelector('.time-range-popover') as HTMLElement;

const triggerIcon = () => trigger().querySelector('[aria-label="calendar"]');

const titleIcon = () => popoverRoot().querySelector('[aria-label="edit"]');

const DISABLED_LINE = 'Options outside the time range limit are disabled.';

async function expectDefaultPicker(timeRangeLimits?: TimeRangeLimits) {
  renderPicker(NO_TIME_RANGE, timeRangeLimits);

  expect(trigger()).not.toHaveAttribute('aria-expanded');
  expect(trigger()).not.toHaveAttribute('aria-controls');
  expect(trigger()).not.toHaveAttribute('aria-haspopup');
  expect(triggerIcon()).not.toHaveAttribute('aria-hidden');
  expect(trigger()).not.toHaveStyleRule('outline', expect.any(String), {
    target: ':focus-visible',
  });
  await waitFor(() =>
    expect(
      trigger().querySelector('.date-label-content') as HTMLElement,
    ).toHaveStyle({ color: supersetTheme.colorTextPlaceholder }),
  );

  trigger().focus();
  expect(fireEvent.keyDown(trigger(), { key: ' ' })).toBe(true);
  fireEvent.keyDown(trigger(), { key: 'Enter' });
  expect(screen.queryByText('Actual time range')).not.toBeInTheDocument();

  await openPicker();
  await waitForTriggerFocus();
  expect(trigger()).toHaveFocus();
  expect(trigger()).not.toHaveAttribute('aria-controls');
  expect(titleIcon()).not.toHaveAttribute('aria-hidden');

  await chooseFrame('Last');
  await screen.findByRole('radio', { name: 'Last week' });
  expect(screen.getByRole('radiogroup')).not.toHaveAttribute('aria-labelledby');
  expect(screen.queryByText(DISABLED_LINE)).not.toBeInTheDocument();

  await chooseFrame('Advanced');
  await screen.findByText('Configure Advanced Time Range');
  textboxes()
    .filter(box => box.getAttribute('role') !== 'combobox')
    .forEach(box => expect(box).not.toHaveAttribute('aria-label'));
}

test('a11y: without the prop the picker is unchanged', async () => {
  await expectDefaultPicker();
}, 30000);

test('a11y: levels with no rule leave the picker unchanged', async () => {
  await expectDefaultPicker({
    levels: [
      { source: 'global', policy: policy() },
      { source: 'dashboard', policy: null },
    ],
    dashboardId: 1,
  });
}, 30000);

test('a11y: Enter and Space on the focused trigger open the picker', async () => {
  renderPicker('Last week', limitsOn());

  trigger().focus();
  await userEvent.keyboard('{Enter}');
  expect(await screen.findByText('Actual time range')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await contentGone();

  trigger().focus();
  await userEvent.keyboard(' ');
  expect(await screen.findByText('Actual time range')).toBeInTheDocument();
});

test('a11y: the trigger exposes aria-expanded and aria-controls, open or closed', async () => {
  renderPicker('Last week', limitsOn());

  expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  const popoverId = trigger().getAttribute('aria-controls');
  expect(popoverId).toBeTruthy();
  expect(trigger()).not.toHaveAttribute('aria-haspopup');

  await openPicker();
  expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  expect(trigger()).not.toHaveAttribute('aria-haspopup');
  expect(trigger()).toHaveAttribute('aria-controls', popoverId!);
  const controlled = document.getElementById(popoverId!);
  expect(popoverRoot()).toContainElement(controlled);
  expect(controlled).toContainElement(screen.getByText('Actual time range'));
  expect(controlled).toContainElement(
    screen.getByRole('combobox', { name: /^Range type/ }),
  );

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await contentGone();
  expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  expect(trigger()).toHaveAttribute('aria-controls', popoverId!);
});

test('a11y: a valid value focuses the Range type as soon as the content shows, and it stays', async () => {
  const release = hold('Last week');
  renderPicker('Last week', limitsOn());
  await openPicker();
  const rangeType = screen.getByRole('combobox', { name: /^Range type/ });

  await waitFor(() => expect(rangeType).toHaveFocus());
  expect(applyButton()).toBeDisabled();
  release();
  await waitForCheck();
  await waitFor(() => expect(applyButton()).toBeEnabled());
  expect(rangeType).toHaveFocus();
});

test('a11y: an invalid value focuses the Range type, then its first invalid field', async () => {
  const release = hold('2025-05-01 : 2025-06-02');
  renderPicker('2025-05-01 : 2025-06-02', limitsOn());
  await openPicker();

  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: /^Range type/ })).toHaveFocus(),
  );
  release();
  await waitFor(() => expect(textboxes()[1]).toHaveFocus(), { timeout: 5000 });
});

test('a11y: the Advanced Start and End fields are named', async () => {
  renderPicker('2025-03-01 : 2025-05-31', limitsOn());
  await openPicker();

  expect(
    screen.getByRole('textbox', { name: 'Start (inclusive)' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('textbox', { name: 'End (exclusive)' }),
  ).toBeInTheDocument();
});

test('a11y: the Last, Previous and Current radio groups are named', async () => {
  renderPicker('Last week', limitsOn());
  await openPicker();

  expect(
    screen.getByRole('radiogroup', { name: 'Configure Time Range: Last...' }),
  ).toContainElement(screen.getByRole('radio', { name: 'Last week' }));

  await chooseFrame('Previous');
  expect(
    await screen.findByRole('radiogroup', {
      name: 'Configure Time Range: Previous...',
    }),
  ).toBeInTheDocument();

  await chooseFrame('Current');
  expect(
    await screen.findByRole('radiogroup', {
      name: 'Configure Time Range: Current...',
    }),
  ).toBeInTheDocument();
});

test('a11y: the limits message on the trigger is not in placeholder colour', async () => {
  renderPicker(
    '2025-01-01 : ',
    limitsOn(POLICY_A, 'dashboard', { dashboardId: 7 }),
  );

  expect(trigger()).toHaveTextContent(
    "Select a time range within this dashboard's limits.",
  );
  const content = trigger().querySelector('.date-label-content') as HTMLElement;
  expect(content).toHaveStyle({ color: supersetTheme.colorText });
  expect(content).not.toHaveStyle({
    color: supersetTheme.colorTextPlaceholder,
  });
});

test('a11y: the trigger shows the theme focus outline with limits on', () => {
  renderPicker('Last week', limitsOn());

  expect(trigger()).toHaveStyleRule(
    'outline',
    `${supersetTheme.lineWidthFocus}px solid ${supersetTheme.colorPrimaryBorder}`,
    { target: ':focus-visible' },
  );
  expect(trigger()).toHaveStyleRule('outline-offset', '1px', {
    target: ':focus-visible',
  });
});

test('a11y: without limits the trigger has no focus outline rule', () => {
  renderPicker('Last week');

  expect(trigger()).not.toHaveStyleRule('outline', expect.any(String), {
    target: ':focus-visible',
  });
});

test('a11y: disabled presets get a line, which describes the group with the limit line', async () => {
  renderPicker('Last week', limitsOn());
  await openPicker();
  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'Last year' })).toBeDisabled(),
  );
  await waitForCheck();

  const line = screen.getByText(DISABLED_LINE);
  const group = screen.getByRole('radiogroup', {
    name: 'Configure Time Range: Last...',
  });
  await waitFor(() =>
    expect(group.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2),
  );
  const [lineId, limitLineId] = group
    .getAttribute('aria-describedby')!
    .split(' ');
  expect(document.getElementById(lineId)).toBe(line);
  expect(document.getElementById(limitLineId)).toHaveTextContent(
    /^Limit on this dashboard: up to 3 months/,
  );
});

test('a11y: no line when no preset is disabled', async () => {
  renderPicker(
    'Last week',
    limitsOn(policy({ max_look_back: rule(2, 'P1Y') })),
  );
  await openPicker();
  await waitFor(() => expect(presetRequests()).toHaveLength(1));
  await fetchMock.callHistory.flush(true);
  await waitForCheck();

  PRESETS.slice(0, 5).forEach(name =>
    expect(screen.getByRole('radio', { name })).toBeEnabled(),
  );
  expect(screen.queryByText(DISABLED_LINE)).not.toBeInTheDocument();
  expect(
    screen.getByRole('radiogroup', { name: 'Configure Time Range: Last...' }),
  ).not.toHaveAttribute('aria-describedby');
});

test('a11y: the row error, trigger and title icons are hidden with limits on', async () => {
  renderPicker('Last year', limitsOn());

  expect(triggerIcon()).toHaveAttribute('aria-hidden', 'true');
  await openPicker();
  expect(titleIcon()).toHaveAttribute('aria-hidden', 'true');
  await waitFor(() => expect(rowAlert()).toBeInTheDocument());
  const rowIcons = rowAlert().querySelectorAll('[role="img"]');
  expect(rowIcons.length).toBeGreaterThan(0);
  rowIcons.forEach(icon => expect(icon).toHaveAttribute('aria-hidden', 'true'));
});

test('a11y: the error id is added next to the label id on the trigger', async () => {
  renderPicker(
    'Last week',
    limitsOn(POLICY_A, 'dashboard', { describedBy: 'default-value-error' }),
  );

  await waitFor(() =>
    expect(trigger()).toHaveAttribute(
      'aria-describedby',
      'date-label-time_range default-value-error',
    ),
  );
  expect(trigger()).toHaveAttribute('aria-invalid', 'true');
});

test('a11y: with no rule the error id is not added to the trigger', async () => {
  renderPicker('Last week', {
    levels: [{ source: 'dashboard', policy: null }],
    describedBy: 'default-value-error',
  });

  await userEvent.hover(trigger());
  expect(await screen.findByRole('tooltip')).toHaveTextContent(FIELD_TOOLTIP);
  expect(trigger()).toHaveAttribute(
    'aria-describedby',
    'date-label-time_range',
  );
  expect(trigger()).not.toHaveAttribute('aria-invalid');
});

/*
 * keyboard and error state of the picker inside a modal. The parent's
 * onKeyDown stands in for the modal, which closes on Escape.
 */

function renderInParent(value: string, timeRangeLimits?: TimeRangeLimits) {
  mockServer();
  const parentKeys = jest.fn();
  render(
    <Provider store={mockStore({})}>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div onKeyDown={event => parentKeys(event.key)}>
        <DateFilterLabel
          name="time_range"
          value={value}
          onChange={jest.fn()}
          timeRangeLimits={timeRangeLimits}
        />
      </div>
    </Provider>,
  );
  return parentKeys;
}

const ESCAPE = { key: 'Escape', keyCode: 27 };
const TAB = { key: 'Tab', keyCode: 9 };
const SHIFT_TAB = { ...TAB, shiftKey: true };

const rangeType = () => screen.getByRole('combobox', { name: /^Range type/ });

test('Escape closes the picker, not the modal around it, and focuses the trigger', async () => {
  const parentKeys = renderInParent('Last week', limitsOn());
  await openPicker();

  screen.getByRole('radio', { name: 'Last week' }).focus();
  expect(fireEvent.keyDown(document.activeElement!, ESCAPE)).toBe(false);
  await contentGone();
  await waitForTriggerFocus();
  expect(parentKeys).not.toHaveBeenCalledWith('Escape');
}, 30000);

test('Escape with the Custom Start calendar open closes only the calendar', async () => {
  const parentKeys = renderInParent(
    '2025-03-01T00:00:00 : 2025-05-31T00:00:00',
    limitsOn(),
  );
  await openPicker();
  await waitForCheck();

  const [startDate] = screen.getAllByPlaceholderText('Select date');
  await userEvent.click(startDate);
  await waitFor(() =>
    expect(document.querySelector('.ant-picker-dropdown')).toBeVisible(),
  );

  fireEvent.keyDown(startDate, ESCAPE);
  await waitFor(() =>
    expect(document.querySelector('.ant-picker-dropdown')).toHaveClass(
      'ant-picker-dropdown-hidden',
    ),
  );
  expect(screen.getByText('Actual time range')).toBeInTheDocument();
  expect(parentKeys).not.toHaveBeenCalledWith('Escape');

  fireEvent.keyDown(startDate, ESCAPE);
  await contentGone();
  await waitForTriggerFocus();
  expect(parentKeys).not.toHaveBeenCalledWith('Escape');
}, 30000);

test('Escape with the Range type list open closes only the list', async () => {
  const parentKeys = renderInParent('Last week', limitsOn());
  await openPicker();

  await userEvent.click(rangeType());
  await waitFor(() =>
    expect(rangeType()).toHaveAttribute('aria-expanded', 'true'),
  );
  fireEvent.keyDown(rangeType(), ESCAPE);
  await waitFor(() =>
    expect(rangeType()).toHaveAttribute('aria-expanded', 'false'),
  );
  expect(screen.getByText('Actual time range')).toBeInTheDocument();
  expect(parentKeys).not.toHaveBeenCalledWith('Escape');
}, 30000);

test('without limits Escape reaches the modal, unchanged', async () => {
  const parentKeys = renderInParent(NO_TIME_RANGE);
  await openPicker();

  expect(
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), ESCAPE),
  ).toBe(true);
  expect(parentKeys).toHaveBeenCalledWith('Escape');
});

test('Tab from the last control and Shift+Tab from Range type close the picker and focus the trigger', async () => {
  renderInParent('Last week', limitsOn());
  await openPicker();
  await waitFor(() => expect(applyButton()).toBeEnabled(), { timeout: 5000 });

  expect(
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Last week' }), TAB),
  ).toBe(true);
  expect(
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), TAB),
  ).toBe(true);
  expect(fireEvent.keyDown(rangeType(), TAB)).toBe(true);
  expect(screen.getByText('Actual time range')).toBeInTheDocument();

  expect(fireEvent.keyDown(applyButton(), TAB)).toBe(false);
  await contentGone();
  await waitForTriggerFocus();

  await openPicker();
  expect(fireEvent.keyDown(rangeType(), SHIFT_TAB)).toBe(false);
  await contentGone();
  await waitForTriggerFocus();
}, 30000);

test('while Apply is disabled, Tab from Cancel closes the picker', async () => {
  renderInParent(NO_TIME_RANGE, limitsOn());
  await openPicker();
  await screen.findByText('Configure Advanced Time Range');
  expect(applyButton()).toBeDisabled();

  expect(
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), TAB),
  ).toBe(false);
  await contentGone();
  await waitForTriggerFocus();
}, 30000);

test('without limits Tab and Shift+Tab leave the picker open, unchanged', async () => {
  renderInParent(NO_TIME_RANGE);
  await openPicker();

  expect(fireEvent.keyDown(applyButton(), TAB)).toBe(true);
  expect(fireEvent.keyDown(rangeType(), SHIFT_TAB)).toBe(true);
  await screen.findByText('Actual time range');
  expect(screen.getByText('Actual time range')).toBeInTheDocument();
});

function renderInFieldError(timeRangeLimits?: TimeRangeLimits) {
  mockServer();
  render(
    <Provider store={mockStore({})}>
      <Form>
        <FormItem validateStatus="error" help="Please choose a valid value">
          <DateFilterLabel
            name="time_range"
            value="Last week"
            onChange={jest.fn()}
            timeRangeLimits={timeRangeLimits}
          />
        </FormItem>
      </Form>
    </Provider>,
  );
}

const rangeTypeSelect = () =>
  popoverRoot().querySelector('.ant-select') as HTMLElement;

test('with limits the Range type does not take the field error state', async () => {
  renderInFieldError(limitsOn());
  await openPicker();

  expect(rangeTypeSelect()).not.toHaveClass('ant-select-status-error');
});

test('without limits the Range type does not take the field error state either', async () => {
  renderInFieldError();
  await openPicker();

  expect(rangeTypeSelect()).not.toHaveClass('ant-select-status-error');
});

test('with limits a look-back error turns only Start red, not End, the Range type or the trigger form item', async () => {
  mockServer();
  render(
    <Provider store={mockStore({})}>
      <Form>
        <FormItem>
          <DateFilterLabel
            name="time_range"
            value="2024-01-01T00:00:00 : 2025-05-31T00:00:00"
            onChange={jest.fn()}
            timeRangeLimits={limitsOn(
              policy({ max_look_back: rule(13, 'P1M') }),
            )}
          />
        </FormItem>
      </Form>
    </Provider>,
  );
  await openPicker();

  const startMode = await screen.findByRole('combobox', {
    name: /^Start \(inclusive\)/,
  });
  await waitFor(() =>
    expect(startMode).toHaveAttribute('aria-invalid', 'true'),
  );
  const endMode = screen.getByRole('combobox', { name: /^End \(exclusive\)/ });
  const [startDate, endDate] = screen.getAllByPlaceholderText('Select date');
  expect(startMode.closest('.ant-form-item')).toHaveClass(
    'ant-form-item-has-error',
  );
  expect(startMode.closest('.ant-select')).toHaveClass(
    'ant-select-status-error',
  );
  expect(startDate.closest('.ant-picker')).toHaveClass(
    'ant-picker-status-error',
  );
  expect(endMode.closest('.ant-form-item')).not.toHaveClass(
    'ant-form-item-has-error',
  );
  expect(endMode.closest('.ant-select')).not.toHaveClass(
    'ant-select-status-error',
  );
  expect(endDate.closest('.ant-picker')).not.toHaveClass(
    'ant-picker-status-error',
  );
  expect(rangeTypeSelect()).not.toHaveClass('ant-select-status-error');
  const outerItem = trigger().closest('.ant-form-item') as HTMLElement;
  expect(outerItem).not.toHaveClass('ant-form-item-has-error');
  expect(outerItem).not.toContainElement(startMode);
  expect(
    within(outerItem).queryByText(/Start can't be earlier/),
  ).not.toBeInTheDocument();
});

test('with limits and no label id (Explore), the trigger is named by its value only, with no dangling id', async () => {
  renderPicker('Last week', limitsOn());

  await waitFor(() =>
    expect(trigger()).toHaveAttribute(
      'aria-labelledby',
      'date-label-time_range',
    ),
  );
  expect(document.getElementById('date-label-time_range')).toBeInTheDocument();
});

test('with limits and a label id (filter bar), the trigger is named by the filter name and its value', async () => {
  renderPicker(
    'Last week',
    limitsOn(POLICY_A, 'dashboard', { labelledBy: 'filter-name-NATIVE_1' }),
  );

  await waitFor(() =>
    expect(trigger()).toHaveAttribute(
      'aria-labelledby',
      'filter-name-NATIVE_1 date-label-time_range',
    ),
  );
});

test('without limits the trigger keeps its default aria-labelledby', () => {
  renderPicker('Last week', undefined);

  expect(trigger()).toHaveAttribute(
    'aria-labelledby',
    'filter-name-time_range',
  );
});

test('the trigger is aria-invalid while its applied range breaks the limits', async () => {
  renderPicker('Last year', limitsOn());

  await waitFor(() =>
    expect(trigger()).toHaveAttribute('aria-invalid', 'true'),
  );
});

test('a range within the limits leaves the trigger without aria-invalid', async () => {
  renderPicker('Last week', limitsOn());
  await waitFor(() =>
    expect(fetchMock.callHistory.calls().length).toBeGreaterThan(0),
  );
  await userEvent.hover(trigger());
  expect(await screen.findByRole('tooltip')).toHaveTextContent('2025-05-24');

  expect(trigger()).not.toHaveAttribute('aria-invalid');
});

test('opening on an applied range waits for its open-time answer', async () => {
  const value = '2025-05-01 : 2025-06-02';
  renderPicker(value, limitsOn());
  await waitFor(() => expect(timeRangeRequests().length).toBeGreaterThan(0));
  await settled();
  const onMount = timeRangeRequests().length;
  const release = hold(value);
  await openPicker();
  const [, end] = textboxes();
  await waitFor(() =>
    expect(timeRangeRequests().length).toBeGreaterThan(onMount),
  );
  expect(applyButton()).toBeDisabled();
  expect(end).not.toHaveAttribute('aria-invalid');
  expect(end).not.toHaveAttribute('aria-describedby');

  release();
  await waitFor(() => expect(end).toHaveAttribute('aria-invalid', 'true'));
  expect(applyButton()).toBeDisabled();
});

test('opening on an applied preset waits before marking its radio', async () => {
  const value = 'Last year';
  renderPicker(value, limitsOn());
  await waitFor(() => expect(timeRangeRequests().length).toBeGreaterThan(0));
  await settled();
  const onMount = timeRangeRequests().length;
  const release = holdDraft(value);
  await openPicker();
  const radio = await screen.findByRole('radio', { name: 'Last year' });
  await waitFor(() =>
    expect(timeRangeRequests().length).toBeGreaterThan(onMount),
  );
  expect(radio).not.toHaveAttribute('aria-invalid');

  release();
  await waitFor(() => expect(radio).toHaveAttribute('aria-invalid', 'true'));
});

test('with no limit line the preset group names only the disabled-options line', async () => {
  const value = 'Last day';
  const release = holdDraft(value);
  renderPicker(value, limitsOn());
  await openPicker();
  const group = await screen.findByRole('radiogroup');
  await waitFor(() =>
    expect(screen.getByRole('radio', { name: 'Last year' })).toBeDisabled(),
  );
  const ids = (group.getAttribute('aria-describedby') ?? '').split(' ');
  expect(ids).toHaveLength(1);
  // eslint-disable-next-line testing-library/no-node-access
  expect(document.getElementById(ids[0])).toHaveTextContent(
    'Options outside the time range limit are disabled.',
  );
  release();
  await settled();
});

test('a server error in the row marks the Advanced fields invalid', async () => {
  renderPicker('2025-06-01 : 2025-05-01', limitsOn());
  await openPicker();

  await waitFor(() =>
    textboxes().forEach(input =>
      expect(input).toHaveAttribute('aria-invalid', 'true'),
    ),
  );
  expect(rowAlert()).toHaveTextContent(START_AFTER_END);
});

test('a "range could not be checked" row describes the checked preset but does not mark it invalid', async () => {
  renderPicker('Last week', limitsOn(policy({ max_span: rule(1, 'P1Q') })));
  await openPicker();

  const lastWeek = screen.getByRole('radio', { name: 'Last week' });
  await waitFor(() =>
    expect(describedText(lastWeek)).toBe('Time range could not be checked.'),
  );
  screen
    .getAllByRole('radio')
    .forEach(radio => expect(radio).not.toHaveAttribute('aria-invalid'));
});

const NO_VALID_RANGE_POLICY = policy({
  max_look_back: rule(0, 'PT1H'),
  max_look_forward: rule(0, 'PT1H'),
});

test('with no valid range, Custom marks no field invalid', async () => {
  renderPicker(
    '2025-05-01T00:00:00 : 2025-05-31T00:00:00',
    limitsOn(NO_VALID_RANGE_POLICY),
  );
  await openPicker();

  await waitFor(() =>
    expect(rowAlert()).toHaveTextContent(/^No time range fits the limits/),
  );
  [
    screen.getByRole('combobox', { name: /^Start \(inclusive\)/ }),
    screen.getByRole('combobox', { name: /^End \(exclusive\)/ }),
    ...screen.getAllByPlaceholderText('Select date'),
  ].forEach(element =>
    expect(element).not.toHaveAttribute('aria-invalid', 'true'),
  );
});

test('while start is after end the Start calendar still greys the look-back days', async () => {
  renderPicker('2024-05-01T00:00:00 : 2024-07-31T00:00:00', limitsOn());
  await openPicker();
  await waitForCheck();

  const [startDate, endDate] = screen.getAllByPlaceholderText('Select date');
  await userEvent.click(endDate);
  await userEvent.type(endDate, '2024-04-15 00:00:00{Enter}', {
    skipClick: true,
    initialSelectionStart: 0,
    initialSelectionEnd: (endDate as HTMLInputElement).value.length,
  });
  await waitFor(() => expect(rowAlert()).toHaveTextContent(START_AFTER_END));

  await userEvent.click(startDate);
  const startCell = (day: string) =>
    Array.from(document.querySelectorAll(`td[title="${day}"]`)).pop();
  await waitFor(() =>
    expect(startCell('2024-04-29')).toHaveClass('ant-picker-cell-disabled'),
  );
  expect(startCell('2024-04-30')).not.toHaveClass('ant-picker-cell-disabled');
}, 30000);

test('a typed End the calendar greys is kept after Escape closes the calendar and Tab', async () => {
  renderPicker('2025-03-01T00:00:00 : 2025-05-31T00:00:00', limitsOn());
  await openPicker();
  await waitForCheck();

  const [, endDate] = screen.getAllByPlaceholderText('Select date');
  await userEvent.click(endDate);
  await userEvent.type(endDate, '2025-06-02 00:00:00', {
    skipClick: true,
    initialSelectionStart: 0,
    initialSelectionEnd: (endDate as HTMLInputElement).value.length,
  });
  fireEvent.keyDown(endDate, ESCAPE);
  await waitFor(() =>
    expect(
      Array.from(document.querySelectorAll('.ant-picker-dropdown')).pop(),
    ).toHaveClass('ant-picker-dropdown-hidden'),
  );
  expect(endDate).toHaveFocus();
  await userEvent.tab();

  await waitFor(() => expect(endDate).toHaveAttribute('aria-invalid', 'true'));
  expect(describedText(endDate)).toContain("End can't be later than today.");
  expect(endDate).toHaveValue('2025-06-02 00:00:00');
  expect(applyButton()).toBeDisabled();
}, 30000);

test('a "no valid range" row describes the checked preset but does not mark it invalid', async () => {
  renderPicker('Last week', limitsOn(NO_VALID_RANGE_POLICY));
  await openPicker();

  const lastWeek = screen.getByRole('radio', { name: 'Last week' });
  await waitFor(() =>
    expect(describedText(lastWeek)).toMatch(/^No time range fits the limits/),
  );
  screen
    .getAllByRole('radio')
    .forEach(radio => expect(radio).not.toHaveAttribute('aria-invalid'));
});

test.each([
  ['no valid range', NO_VALID_RANGE_POLICY, /^No time range fits the limits/],
  [
    'range could not be checked',
    policy({ max_span: rule(1, 'P1Q') }),
    /^Time range could not be checked/,
  ],
])('a "%s" row marks no Advanced field invalid', async (_, rules, message) => {
  renderPicker('2025-05-01 : 2025-05-31', limitsOn(rules));
  await openPicker();

  await waitFor(() => expect(rowAlert()).toHaveTextContent(message));
  textboxes().forEach(input =>
    expect(input).not.toHaveAttribute('aria-invalid'),
  );
});

test('Custom calendars keep absolute limits before validation and after a reversed range', async () => {
  const clock = SERVER['today : now'];
  SERVER['today : now'] = ['2026-11-04T00:00:00', '2026-11-04T14:30:00'];
  try {
    renderPicker(
      '2026-10-21T00:00:00 : 2026-11-04T00:00:00',
      limitsOn(
        policy({
          max_span: rule(1, 'P1M'),
          max_look_back: rule(2, 'P1M'),
          max_look_forward: rule(0, 'P1D'),
        }),
      ),
    );
    await openPicker();
    await waitForCheck();
    const [start, end] = screen.getAllByPlaceholderText('Select date');
    const release = holdDraft('2026-10-21T00:00:00 : 2026-10-14T00:00:00');
    await userEvent.click(end);
    await userEvent.type(end, '2026-10-14 00:00:00{Enter}', {
      skipClick: true,
      initialSelectionStart: 0,
      initialSelectionEnd: (end as HTMLInputElement).value.length,
    });
    await userEvent.click(start);
    const cell = (day: string) =>
      document.querySelector(
        `.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) td[title="${day}"]`,
      );
    await waitFor(() =>
      expect(cell('2026-09-30')).not.toHaveClass('ant-picker-cell-disabled'),
    );
    release();
    await waitFor(() => expect(rowAlert()).toHaveTextContent(START_AFTER_END));
    expect(cell('2026-09-30')).not.toHaveClass('ant-picker-cell-disabled');
    await userEvent.type(start, '2026-10-01 00:00:00{Enter}', {
      skipClick: true,
      initialSelectionStart: 0,
      initialSelectionEnd: (start as HTMLInputElement).value.length,
    });
    await userEvent.click(end);
    await waitFor(() =>
      expect(cell('2026-11-02')).not.toHaveClass('ant-picker-cell-disabled'),
    );
  } finally {
    SERVER['today : now'] = clock;
  }
}, 30000);

test('Custom Start enables days on or after the edited exclusive End inside absolute limits', async () => {
  const clock = SERVER['today : now'];
  SERVER['today : now'] = ['2026-11-04T00:00:00', '2026-11-04T14:30:00'];
  try {
    renderPicker(
      '2026-10-21T00:00:00 : 2026-11-04T00:00:00',
      limitsOn(
        policy({
          max_span: rule(1, 'P1M'),
          max_look_back: rule(2, 'P1M'),
          max_look_forward: rule(0, 'P1D'),
        }),
      ),
    );
    await openPicker();
    await waitForCheck();
    const [start, end] = screen.getAllByPlaceholderText('Select date');
    await userEvent.click(end);
    await userEvent.type(end, '2026-10-13 00:00:00{Enter}', {
      skipClick: true,
      initialSelectionStart: 0,
      initialSelectionEnd: (end as HTMLInputElement).value.length,
    });
    await userEvent.click(start);
    const cell = (day: string) =>
      document.querySelector(
        `.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) td[title="${day}"]`,
      );
    await waitFor(() =>
      expect(cell('2026-10-13')).not.toHaveClass('ant-picker-cell-disabled'),
    );
    expect(cell('2026-10-12')).not.toHaveClass('ant-picker-cell-disabled');
    for (const day of ['2026-11-01', '2026-11-02', '2026-11-03']) {
      expect(cell(day)).not.toHaveClass('ant-picker-cell-disabled');
    }
  } finally {
    SERVER['today : now'] = clock;
  }
}, 30000);

test.each([
  ['backward', '2024-05-31', '2024-05-01', START_AFTER_END],
  ['forward', '2026-05-31', '2026-05-01', /Range can't be longer than/],
])(
  'Custom permits a year %s calendar move and validates until Start is repaired',
  async (_, endDay, startDay, error) => {
    renderPicker(
      '2025-05-01T00:00:00 : 2025-05-31T00:00:00',
      limitsOn(
        policy({
          max_span: rule(3, 'P1M'),
          max_look_back: rule(2, 'P1Y'),
          max_look_forward: rule(2, 'P1Y'),
        }),
      ),
    );
    await openPicker();
    await waitForCheck();
    const [start, end] = screen.getAllByPlaceholderText('Select date');
    const calendar = () =>
      document.querySelector<HTMLElement>(
        '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)',
      )!;
    const moveYear = async () => {
      await userEvent.click(
        calendar().querySelector<HTMLElement>(
          endDay.startsWith('2024')
            ? '.ant-picker-header-super-prev-btn'
            : '.ant-picker-header-super-next-btn',
        )!,
      );
    };
    await userEvent.click(end);
    await moveYear();
    const endCell = calendar().querySelector<HTMLElement>(
      `td[title="${endDay}"]`,
    )!;
    expect(endCell).not.toHaveClass('ant-picker-cell-disabled');
    await userEvent.click(endCell);
    await userEvent.click(
      within(calendar()).getByRole('button', { name: 'OK' }),
    );
    await waitFor(() => expect(end).toHaveValue(`${endDay} 00:00:00`));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(error),
    );
    expect(applyButton()).toBeDisabled();
    await userEvent.click(start);
    await moveYear();
    await userEvent.click(
      calendar().querySelector<HTMLElement>(`td[title="${startDay}"]`)!,
    );
    await userEvent.click(
      within(calendar()).getByRole('button', { name: 'OK' }),
    );
    await waitFor(() => expect(start).toHaveValue(`${startDay} 00:00:00`));
    await waitFor(() => expect(applyButton()).toBeEnabled());
  },
  30000,
);

test('Custom End days inside absolute bounds stay enabled with a Relative Start', async () => {
  const value =
    'DATEADD(DATETIME("2025-05-31T00:00:00"), -3, week) : 2025-05-31T00:00:00';
  SERVER[value] = ['2025-05-10T00:00:00', '2025-05-31T00:00:00'];
  try {
    renderPicker(value, limitsOn());
    await openPicker();
    await waitForCheck();
    expect(screen.getByText('Weeks Before')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Relative quantity')).toHaveValue('3');
    await userEvent.click(screen.getByPlaceholderText('Select date'));
    const calendar = document.querySelector<HTMLElement>(
      '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)',
    )!;
    await userEvent.click(
      calendar.querySelector<HTMLElement>('.ant-picker-header-prev-btn')!,
    );
    expect(calendar.querySelector('td[title="2025-04-30"]')).not.toHaveClass(
      'ant-picker-cell-disabled',
    );
  } finally {
    delete SERVER[value];
  }
}, 30000);

test('a saved relative expression opens Advanced unchanged and can be applied', async () => {
  const onChange = renderPicker(
    'Last 3 months',
    onDashboard(policy({ max_span: rule(3, 'P1M') })),
  );
  await openPicker();
  expect(screen.getByText('Configure Advanced Time Range')).toBeInTheDocument();
  await waitFor(() =>
    expect(row()).toHaveTextContent('2025-08-04 ≤ col < 2025-11-04'),
  );
  expect(applyButton()).toBeEnabled();
  expect(textboxes()[1]).not.toHaveAttribute('aria-invalid', 'true');
  await userEvent.click(applyButton());
  expect(onChange).toHaveBeenCalledWith('Last 3 months');
});

test('manually clearing Advanced End still requires an end date', async () => {
  renderPicker('Last 3 months', onDashboard());
  await openPicker();
  const [, end] = textboxes();
  await userEvent.type(end, 'today');
  await userEvent.clear(end);
  await waitFor(() => expect(end).toHaveAttribute('aria-invalid', 'true'));
  expect(describedText(end)).toContain('End is required on this dashboard');
  expect(applyButton()).toBeDisabled();
});

test('switching a calendar range to Advanced clears the fields with limits true', async () => {
  renderPicker('previous calendar week', onDashboard());
  await openPicker();
  await chooseFrame('Advanced');
  const [start, end] = textboxes();
  expect(start).toHaveValue('');
  expect(end).toHaveValue('');
  await waitFor(() => {
    expect(start).toHaveAttribute('aria-invalid', 'true');
    expect(end).toHaveAttribute('aria-invalid', 'true');
  });
  expect(rowAlert()).toHaveTextContent(
    'Choose a start and an end date. Time range limits are on.',
  );
  expect(applyButton()).toBeDisabled();
});

test('switching a calendar range to Advanced clears the fields with limits false', async () => {
  renderPicker('previous calendar week', undefined);
  await openPicker();
  await chooseFrame('Advanced');
  const [start, end] = textboxes();
  expect(start).toHaveValue('');
  expect(end).toHaveValue('');
  await waitFor(() =>
    expect(mockedFetchTimeRange).toHaveBeenCalledWith(
      ' : ',
      'col',
      undefined,
      undefined,
    ),
  );
  expect(start).not.toHaveAttribute('aria-invalid');
  expect(end).not.toHaveAttribute('aria-invalid');
});
