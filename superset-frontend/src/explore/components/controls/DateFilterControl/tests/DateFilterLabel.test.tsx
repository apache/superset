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

test('DateFilter popover should attach to parent node when overflowing in filter bar', () => {
  render(setup({ ...defaultProps, isOverflowingFilterBar: true }));

  userEvent.click(screen.getByText(NO_TIME_RANGE));

  const popover = document.querySelector<HTMLElement>('.time-range-popover');
  const trigger = screen.getByTestId(DateFilterTestKey.PopoverOverlay);

  expect(popover?.parentElement).toBe(trigger.parentElement);
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

  // When overflowing, popover should attach to parent node
  rerender(setup({ ...defaultProps, isOverflowingFilterBar: true }));
  userEvent.click(screen.getByText(NO_TIME_RANGE));

  const popoverAfterRerender = document.querySelector('.time-range-popover');
  const trigger = screen.getByTestId(DateFilterTestKey.PopoverOverlay);

  expect(popoverAfterRerender?.parentElement).toBe(trigger.parentElement);
  expect(popoverAfterRerender?.parentElement).not.toBe(document.body);
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
