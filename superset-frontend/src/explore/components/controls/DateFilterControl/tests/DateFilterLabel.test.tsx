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
  render,
  screen,
  userEvent,
  waitFor,
  fireEvent,
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
const DISPLAY_TOOLTIP = '01/01/2024 – 07/01/2024';
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
  expect(screen.getByTestId('basic-calendar')).toBeInTheDocument();
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
    width: 'min(800px, calc(100vw - 32px))',
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
    width: 'min(800px, calc(100vw - 32px))',
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
    '2024-01-01 – 2024-01-08 (%d-%m-%Y)',
  );
});

test('blocks Apply until the changed draft has been evaluated', async () => {
  const onChange = jest.fn();
  render(setup({ ...defaultProps, onChange, value: 'Last week' }));
  await userEvent.click(screen.getByText('Last week'));
  await userEvent.click(screen.getByRole('button', { name: 'Last month' }));
  expect(screen.getByText('Apply').closest('button')).toBeDisabled();
  await waitFor(() =>
    expect(screen.getByText('Apply').closest('button')).toBeEnabled(),
  );
  await userEvent.click(screen.getByText('Apply'));
  expect(onChange).toHaveBeenCalledWith('Last month');
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
  expect(await screen.findByRole('tooltip')).toHaveTextContent(DISPLAY_TOOLTIP);

  const descriptionIcon = screen.getByRole('button', {
    name: 'Show info tooltip',
  });
  fireEvent.focus(descriptionIcon);

  await waitFor(() => {
    expect(screen.getByRole('tooltip')).toHaveTextContent(DESCRIPTION_TOOLTIP);
    expect(screen.getByRole('tooltip')).not.toHaveTextContent(DISPLAY_TOOLTIP);
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
  });

  fireEvent.blur(descriptionIcon);
  await waitFor(() => {
    expect(screen.getByRole('tooltip')).toHaveTextContent(DISPLAY_TOOLTIP);
    expect(screen.getAllByRole('tooltip')).toHaveLength(1);
  });

  await userEvent.unhover(screen.getByText('Last week'));
  await waitFor(() => {
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  await userEvent.hover(descriptionIcon);

  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveTextContent(DESCRIPTION_TOOLTIP);
  expect(tooltip).not.toHaveTextContent(DISPLAY_TOOLTIP);
  expect(screen.getAllByRole('tooltip')).toHaveLength(1);

  await userEvent.unhover(descriptionIcon);
  await waitFor(() => {
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  fireEvent.keyDown(descriptionIcon, { key: 'Enter' });
  expect(tooltipOnClick).toHaveBeenCalled();
});

test.each([
  ['date', 'Simple Date Range', 'Start date'],
  ['datetime', 'Simple Date Time Range', 'Start date and time'],
] as const)(
  'locks the %s control to the author-selected mode without advanced UI',
  async (calendarMode, title, inputName) => {
    render(setup({ ...defaultProps, value: 'Last week', calendarMode }));
    await userEvent.click(screen.getByText('Last week'));
    expect(screen.getByText(title)).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: inputName }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByText('Advanced options')).not.toBeInTheDocument();
    expect(screen.queryByText('Actual time range')).not.toBeInTheDocument();
    expect(screen.queryByText(/≤ col </)).not.toBeInTheDocument();
  },
);

test('backend validation errors block Apply and a corrected date range clears the error', async () => {
  const error = 'Invalid time range expression';
  mockedFetchTimeRange.mockImplementation(async value =>
    value === 'bogus' ? { error } : { value: FIELD_TOOLTIP },
  );
  render(setup({ ...defaultProps, value: 'bogus', calendarMode: 'date' }));
  await userEvent.click(await screen.findByRole('button'));
  expect(await screen.findByRole('alert')).toHaveTextContent(error);
  expect(screen.getByTestId(DateFilterTestKey.ApplyButton)).toBeDisabled();
  await userEvent.type(
    screen.getByRole('textbox', { name: 'Start date' }),
    '01/01/2024',
  );
  await userEvent.type(
    screen.getByRole('textbox', { name: 'End date' }),
    '07/01/2024',
  );
  await waitFor(() =>
    expect(screen.getByTestId(DateFilterTestKey.ApplyButton)).toBeEnabled(),
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('All time clears the range without showing technical preview expressions', async () => {
  const onChange = jest.fn();
  render(setup({ ...defaultProps, onChange, value: 'Last week' }));
  await userEvent.click(screen.getByText('Last week'));
  await userEvent.click(screen.getByRole('button', { name: 'All time' }));
  await userEvent.click(screen.getByTestId(DateFilterTestKey.ApplyButton));
  expect(onChange).toHaveBeenCalledWith(NO_TIME_RANGE);
});

test('Cancel discards an unsaved range selection', async () => {
  render(setup({ ...defaultProps, value: 'Last week' }));
  await userEvent.click(screen.getByText('Last week'));
  await userEvent.click(screen.getByRole('button', { name: 'Last month' }));

  await userEvent.click(screen.getByTestId(DateFilterTestKey.CancelButton));
  await waitFor(() => {
    expect(screen.queryByText('Edit time range')).not.toBeInTheDocument();
  });
  await userEvent.click(screen.getByText('Last week'));

  expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('button', { name: 'Last month' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('an incomplete calendar selection disables Apply and Cancel discards it', async () => {
  const onChange = jest.fn();
  render(
    setup({ ...defaultProps, onChange, value: '2026-10-01 : 2026-10-08' }),
  );
  await userEvent.click(await screen.findByRole('button'));
  await userEvent.click(screen.getByRole('button', { name: '2026-10-03' }));
  expect(screen.getByText('Apply').closest('button')).toBeDisabled();
  await userEvent.click(screen.getByText('Cancel'));
  expect(onChange).not.toHaveBeenCalled();
});

test('manual partial dates disable Apply until corrected, and text does not open the endpoint picker', async () => {
  const onChange = jest.fn();
  render(
    setup({ ...defaultProps, onChange, value: '2026-10-01 : 2026-10-08' }),
  );
  await userEvent.click(await screen.findByRole('button'));
  const input = screen.getByRole('textbox', { name: 'Start date' });
  await userEvent.clear(input);
  await userEvent.type(input, '31/02/2026');
  expect(screen.getByTestId(DateFilterTestKey.ApplyButton)).toBeDisabled();
  expect(
    screen.queryByTestId('basic-date-picker-popup'),
  ).not.toBeInTheDocument();
  fireEvent.blur(input);
  expect(input).toHaveValue('31/02/2026');
  await userEvent.clear(input);
  await userEvent.type(input, '03/10/2026');
  await waitFor(() =>
    expect(screen.getByTestId(DateFilterTestKey.ApplyButton)).toBeEnabled(),
  );
  await userEvent.click(screen.getByTestId(DateFilterTestKey.ApplyButton));
  expect(onChange).toHaveBeenCalledWith('2026-10-03 : 2026-10-08');
});

test('saved timestamps open editable date-time fields and preserve exact bounds', async () => {
  const onChange = jest.fn();
  render(
    setup({
      ...defaultProps,
      onChange,
      value: '2026-10-09T12:10:00 : 2026-10-09T16:25:00',
    }),
  );
  await userEvent.click(await screen.findByRole('button'));
  expect(screen.getByTestId('basic-calendar')).toBeInTheDocument();
  expect(
    screen.getByRole('textbox', { name: 'Start date and time' }),
  ).toHaveValue('09/10/2026 12:10');
  const end = screen.getByRole('textbox', { name: 'End date and time' });
  await userEvent.clear(end);
  await userEvent.type(end, '09/10/2026 18:45');
  await waitFor(() =>
    expect(screen.getByTestId(DateFilterTestKey.ApplyButton)).toBeEnabled(),
  );
  await userEvent.click(screen.getByTestId(DateFilterTestKey.ApplyButton));
  expect(onChange).toHaveBeenCalledWith(
    '2026-10-09T12:10:00 : 2026-10-09T18:45:00',
  );
});
