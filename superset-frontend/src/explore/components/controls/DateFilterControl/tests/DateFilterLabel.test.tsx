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

import { NO_TIME_RANGE, fetchTimeRange } from '@superset-ui/core';
import {
  PopoverProps,
  SHIFT_INTO_VIEWPORT,
} from '../../ControlPopover/ControlPopover';
import DateFilterLabel from '..';
import { DateFilterControlProps } from '../types';
import { DateFilterTestKey } from '../utils';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  fetchTimeRange: jest.fn(),
}));

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
