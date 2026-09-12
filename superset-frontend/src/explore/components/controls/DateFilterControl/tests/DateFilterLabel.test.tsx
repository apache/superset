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
  act,
  selectOption,
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
const EMPTY_TIME_RANGE = '2024-01-01 ≤ col < 2024-01-01';
const EMPTY_TIME_RANGE_WARNING =
  'This time range is empty. Choose an end time later than the start time.';
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

test('DateFilter with default props', () => {
  render(setup());
  // label
  expect(screen.getByText(NO_TIME_RANGE)).toBeInTheDocument();

  // should be popover by default
  userEvent.click(screen.getByText(NO_TIME_RANGE));
  expect(
    screen.getByTestId(DateFilterTestKey.PopoverOverlay),
  ).toBeInTheDocument();
});

test('DateFilter should be applied the global config time_filter from the store', () => {
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

  userEvent.click(screen.getByText('Last week'));
  expect(screen.getByTestId(DateFilterTestKey.CommonFrame)).toBeInTheDocument();
});

test('Open and close popover', () => {
  render(setup());

  // click "Cancel"
  userEvent.click(screen.getByText(NO_TIME_RANGE));
  expect(defaultProps.onOpenPopover).toHaveBeenCalled();
  expect(screen.getByText('Edit time range')).toBeInTheDocument();
  userEvent.click(screen.getByText('Cancel'));
  expect(defaultProps.onClosePopover).toHaveBeenCalled();
  expect(screen.queryByText('Edit time range')).not.toBeInTheDocument();

  // click "Apply"
  userEvent.click(screen.getByText(NO_TIME_RANGE));
  expect(defaultProps.onOpenPopover).toHaveBeenCalled();
  expect(screen.getByText('Edit time range')).toBeInTheDocument();
  userEvent.click(screen.getByText('Apply'));
  expect(defaultProps.onClosePopover).toHaveBeenCalled();
  expect(screen.queryByText('Edit time range')).not.toBeInTheDocument();
});

test('warns about an empty time range without preventing Apply', async () => {
  mockedFetchTimeRange.mockResolvedValue({
    value: EMPTY_TIME_RANGE,
    isEmpty: true,
  });
  const onChange = jest.fn();
  render(setup({ ...defaultProps, value: 'today : today', onChange }));

  await userEvent.click(screen.getByTestId(DateFilterTestKey.PopoverOverlay));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    EMPTY_TIME_RANGE_WARNING,
  );
  const applyButton = screen.getByRole('button', { name: 'Apply' });
  expect(applyButton).toBeEnabled();
  await userEvent.click(applyButton);

  expect(onChange).toHaveBeenCalledWith('today : today');
  expect(screen.queryByText('Edit time range')).not.toBeInTheDocument();
});

test('clears the empty time range warning after correcting the end time', async () => {
  mockedFetchTimeRange.mockImplementation(async value =>
    value === 'today : today'
      ? { value: EMPTY_TIME_RANGE, isEmpty: true }
      : { value: FIELD_TOOLTIP, isEmpty: false },
  );
  const onChange = jest.fn();
  render(setup({ ...defaultProps, value: 'today : today', onChange }));
  await userEvent.click(screen.getByTestId(DateFilterTestKey.PopoverOverlay));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    EMPTY_TIME_RANGE_WARNING,
  );

  await selectOption('Advanced', 'Range type');
  fireEvent.change(screen.getAllByRole('textbox')[1], {
    target: { value: 'tomorrow' },
  });

  await waitFor(() => {
    expect(mockedFetchTimeRange).toHaveBeenCalledWith('today : tomorrow');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onChange).toHaveBeenCalledWith('today : tomorrow');
});

test('clears the empty time range warning when choosing No filter', async () => {
  mockedFetchTimeRange.mockResolvedValue({
    value: EMPTY_TIME_RANGE,
    isEmpty: true,
  });
  const onChange = jest.fn();
  render(setup({ ...defaultProps, value: 'today : today', onChange }));
  await userEvent.click(screen.getByTestId(DateFilterTestKey.PopoverOverlay));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    EMPTY_TIME_RANGE_WARNING,
  );

  await selectOption(NO_TIME_RANGE, 'Range type');

  await waitFor(() => {
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onChange).toHaveBeenCalledWith(NO_TIME_RANGE);
});

test('restores the saved empty range warning after cancelling an edit', async () => {
  mockedFetchTimeRange.mockImplementation(async value =>
    value === 'today : today'
      ? { value: EMPTY_TIME_RANGE, isEmpty: true }
      : { value: FIELD_TOOLTIP, isEmpty: false },
  );
  const onChange = jest.fn();
  render(setup({ ...defaultProps, value: 'today : today', onChange }));
  await userEvent.click(screen.getByTestId(DateFilterTestKey.PopoverOverlay));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    EMPTY_TIME_RANGE_WARNING,
  );

  await selectOption('Advanced', 'Range type');
  fireEvent.change(screen.getAllByRole('textbox')[1], {
    target: { value: 'tomorrow' },
  });
  await waitFor(() => {
    expect(mockedFetchTimeRange).toHaveBeenCalledWith('today : tomorrow');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await userEvent.click(screen.getByTestId(DateFilterTestKey.PopoverOverlay));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    EMPTY_TIME_RANGE_WARNING,
  );
  expect(onChange).not.toHaveBeenCalled();
});

test('waits for an empty range evaluation before allowing Apply', async () => {
  let resolveEmptyRange!: (
    result: Awaited<ReturnType<typeof fetchTimeRange>>,
  ) => void;
  const pendingEmptyRange = new Promise<
    Awaited<ReturnType<typeof fetchTimeRange>>
  >(resolve => {
    resolveEmptyRange = resolve;
  });
  mockedFetchTimeRange.mockImplementation(value =>
    value === 'today : today'
      ? pendingEmptyRange
      : Promise.resolve({ value: FIELD_TOOLTIP, isEmpty: false }),
  );
  const onChange = jest.fn();
  render(setup({ ...defaultProps, value: 'today : tomorrow', onChange }));
  await userEvent.click(screen.getByTestId(DateFilterTestKey.PopoverOverlay));
  const applyButton = screen.getByRole('button', { name: 'Apply' });
  await waitFor(() => {
    expect(applyButton).toBeEnabled();
  });

  fireEvent.change(screen.getAllByRole('textbox')[1], {
    target: { value: 'today' },
  });
  expect(applyButton).toBeDisabled();
  await waitFor(() => {
    expect(mockedFetchTimeRange).toHaveBeenCalledWith('today : today');
  });
  expect(applyButton).toBeDisabled();
  await act(async () => {
    resolveEmptyRange({ value: EMPTY_TIME_RANGE, isEmpty: true });
    await pendingEmptyRange;
  });

  expect(screen.getByRole('alert')).toHaveTextContent(EMPTY_TIME_RANGE_WARNING);
  expect(applyButton).toBeEnabled();
  await userEvent.click(applyButton);
  expect(onChange).toHaveBeenCalledWith('today : today');
});

test('preserves the active draft warning when the saved filter is cleared', async () => {
  mockedFetchTimeRange.mockImplementation(async value =>
    value === 'today : today'
      ? { value: EMPTY_TIME_RANGE, isEmpty: true }
      : { value: FIELD_TOOLTIP, isEmpty: false },
  );
  const onChange = jest.fn();
  const { rerender } = render(
    setup({ ...defaultProps, value: 'today : tomorrow', onChange }),
  );
  await userEvent.click(screen.getByTestId(DateFilterTestKey.PopoverOverlay));
  fireEvent.change(screen.getAllByRole('textbox')[1], {
    target: { value: 'today' },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(
    EMPTY_TIME_RANGE_WARNING,
  );

  rerender(setup({ ...defaultProps, value: NO_TIME_RANGE, onChange }));

  expect(screen.getByRole('alert')).toHaveTextContent(EMPTY_TIME_RANGE_WARNING);
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onChange).toHaveBeenCalledWith('today : today');
});

test('ignores an empty evaluation received after the range was corrected', async () => {
  let resolveEmptyRange!: (
    result: Awaited<ReturnType<typeof fetchTimeRange>>,
  ) => void;
  const pendingEmptyRange = new Promise<
    Awaited<ReturnType<typeof fetchTimeRange>>
  >(resolve => {
    resolveEmptyRange = resolve;
  });
  mockedFetchTimeRange.mockImplementation(value =>
    value === 'today : today'
      ? pendingEmptyRange
      : Promise.resolve({ value: FIELD_TOOLTIP, isEmpty: false }),
  );
  const onChange = jest.fn();
  render(setup({ ...defaultProps, value: 'today : tomorrow', onChange }));
  await userEvent.click(screen.getByTestId(DateFilterTestKey.PopoverOverlay));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
  });

  await selectOption('Advanced', 'Range type');
  const [, endInput] = screen.getAllByRole('textbox');
  fireEvent.change(endInput, { target: { value: 'today' } });
  await waitFor(() => {
    expect(mockedFetchTimeRange).toHaveBeenCalledWith('today : today');
  });
  fireEvent.change(endInput, { target: { value: 'tomorrow' } });
  await act(async () => {
    resolveEmptyRange({ value: EMPTY_TIME_RANGE, isEmpty: true });
    await pendingEmptyRange;
  });

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(EMPTY_TIME_RANGE)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(onChange).toHaveBeenCalledWith('today : tomorrow');
});

test('DateFilter popover should attach to document.body when not overflowing', () => {
  render(setup({ ...defaultProps, isOverflowingFilterBar: false }));

  userEvent.click(screen.getByText(NO_TIME_RANGE));

  const popover = document.querySelector<HTMLElement>('.time-range-popover');
  expect(popover?.parentElement).toBe(document.body);
  expect(popover).toHaveStyle({
    width: 'min(600px, calc(100vw - 32px))',
  });
});

test('DateFilter popover shifts into the viewport', async () => {
  render(setup());

  userEvent.click(screen.getByText(NO_TIME_RANGE));

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

test('DateFilter popover should attach to document.body even when overflowing in filter bar', () => {
  render(setup({ ...defaultProps, isOverflowingFilterBar: true }));

  userEvent.click(screen.getByText(NO_TIME_RANGE));

  const popover = document.querySelector<HTMLElement>('.time-range-popover');

  expect(popover?.parentElement).toBe(document.body);
  expect(popover).toHaveStyle({
    width: 'min(600px, calc(100vw - 32px))',
  });
});

test('DateFilter should properly handle isOverflowingFilterBar prop changes', () => {
  const { rerender } = render(
    setup({ ...defaultProps, isOverflowingFilterBar: false }),
  );

  // When not overflowing, popover should attach to document.body
  userEvent.click(screen.getByText(NO_TIME_RANGE));
  const popover = document.querySelector('.time-range-popover');
  expect(popover?.parentElement).toBe(document.body);

  userEvent.click(screen.getByText('Cancel'));

  // Popover should continue to attach to document.body even when overflowing
  rerender(setup({ ...defaultProps, isOverflowingFilterBar: true }));
  userEvent.click(screen.getByText(NO_TIME_RANGE));

  const popoverAfterRerender = document.querySelector('.time-range-popover');

  expect(popoverAfterRerender?.parentElement).toBe(document.body);
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
