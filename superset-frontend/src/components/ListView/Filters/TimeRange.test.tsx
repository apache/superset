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
import { createRef, act } from 'react';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { NO_TIME_RANGE, SupersetClient } from '@superset-ui/core';
import TimeRangeFilter from './TimeRange';
import type { FilterHandler } from './types';

// Suppress debounced evaluation — the initial useEffect handles the committed
// value; the debounced path is an optimistic UX enhancement, not a contract.
jest.mock('src/explore/exploreUtils', () => ({
  ...jest.requireActual('src/explore/exploreUtils'),
  useDebouncedEffect: jest.fn(),
}));

jest.mock('src/explore/components/controls/DateFilterControl/utils', () => ({
  FRAME_OPTIONS: [
    { label: 'No filter', value: 'No filter' },
    { label: 'Custom', value: 'Custom' },
  ],
  guessFrame: jest.fn().mockReturnValue('Custom'),
  // 'No filter' is the string value of NO_TIME_RANGE constant
  useDefaultTimeFilter: jest.fn().mockReturnValue('No filter'),
}));

jest.mock(
  'src/explore/components/controls/DateFilterControl/components',
  () => ({
    AdvancedFrame: () => <div data-test="advanced-frame" />,
    CalendarFrame: () => <div data-test="calendar-frame" />,
    CommonFrame: () => <div data-test="common-frame" />,
    CustomFrame: ({ value }: { value: string }) => (
      <div data-test="custom-frame">{value}</div>
    ),
  }),
);

jest.mock(
  'src/explore/components/controls/DateFilterControl/components/CurrentCalendarFrame',
  () => ({
    CurrentCalendarFrame: () => <div data-testid="current-calendar-frame" />,
  }),
);

const VALID_RANGE = '2024-01-01 : 2024-01-31';

// Default successful response that fetchTimeRange and the Apply handler both use
const MOCK_TIME_RANGE_RESULT = {
  json: {
    result: [{ since: '2024-01-01T00:00:00', until: '2024-01-31T23:59:59' }],
  },
};

let getSpy: jest.SpyInstance;

beforeEach(() => {
  getSpy = jest
    .spyOn(SupersetClient, 'get')
    .mockResolvedValue(MOCK_TIME_RANGE_RESULT as any);
});

afterEach(() => {
  getSpy.mockRestore();
});

function renderFilter(
  props: Partial<{
    value: string;
    onSubmit: jest.Mock;
    onClose: jest.Mock;
  }> = {},
) {
  const onSubmit = props.onSubmit ?? jest.fn();
  const onClose = props.onClose ?? jest.fn();
  return render(
    <TimeRangeFilter
      value={props.value ?? VALID_RANGE}
      onSubmit={onSubmit}
      onClose={onClose}
    />,
  );
}

test('renders range type label, actual time range section, and footer buttons', () => {
  renderFilter();
  expect(screen.getByText('Range type')).toBeInTheDocument();
  expect(screen.getByText('Actual time range')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
});

test('shows the custom frame when guessFrame returns Custom', () => {
  renderFilter();
  expect(screen.getByTestId('custom-frame')).toBeInTheDocument();
});

test('Apply is disabled until the API validates the initial value', async () => {
  // Block resolution so we can observe disabled state
  let resolve: (v: typeof MOCK_TIME_RANGE_RESULT) => void;
  getSpy.mockReturnValue(
    new Promise(res => {
      resolve = res;
    }),
  );

  renderFilter();
  const apply = screen.getByRole('button', { name: /apply/i });
  expect(apply).toBeDisabled();

  act(() => {
    resolve!(MOCK_TIME_RANGE_RESULT);
  });

  await waitFor(() => {
    expect(apply).not.toBeDisabled();
  });
});

test('Apply is enabled when the API returns a valid result', async () => {
  renderFilter();
  const apply = screen.getByRole('button', { name: /apply/i });
  await waitFor(() => {
    expect(apply).not.toBeDisabled();
  });
});

test('Apply is disabled when the API returns an error response', async () => {
  getSpy.mockRejectedValue(new Error('Bad request'));
  renderFilter();
  const apply = screen.getByRole('button', { name: /apply/i });
  // Give fetchTimeRange time to reject and set validTimeRange=false
  await waitFor(() => {
    expect(apply).toBeDisabled();
  });
});

test('Cancel button calls onClose', async () => {
  const onClose = jest.fn();
  renderFilter({ onClose });
  await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('Apply calls onSubmit([since, until]) and onClose when API succeeds', async () => {
  const onSubmit = jest.fn();
  const onClose = jest.fn();

  renderFilter({ onSubmit, onClose });

  const apply = screen.getByRole('button', { name: /apply/i });
  await waitFor(() => {
    expect(apply).not.toBeDisabled();
  });

  await userEvent.click(apply);

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith([
      '2024-01-01T00:00:00',
      '2024-01-31T23:59:59',
    ]);
  });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('Apply calls onClose but not onSubmit when the API call throws', async () => {
  const onSubmit = jest.fn();
  const onClose = jest.fn();

  // fetchTimeRange succeeds (for validTimeRange), but the Apply API call fails
  getSpy
    .mockResolvedValueOnce(MOCK_TIME_RANGE_RESULT as any) // fetchTimeRange in useEffect
    .mockRejectedValueOnce(new Error('network')); // Apply button API call

  renderFilter({ onSubmit, onClose });

  const apply = screen.getByRole('button', { name: /apply/i });
  await waitFor(() => {
    expect(apply).not.toBeDisabled();
  });

  await userEvent.click(apply);

  await waitFor(() => {
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  expect(onSubmit).not.toHaveBeenCalled();
});

test('Apply with NO_TIME_RANGE calls onSubmit(undefined) and onClose without an API call', async () => {
  const onSubmit = jest.fn();
  const onClose = jest.fn();

  render(
    <TimeRangeFilter
      value={NO_TIME_RANGE}
      onSubmit={onSubmit}
      onClose={onClose}
    />,
  );

  const apply = screen.getByRole('button', { name: /apply/i });
  await waitFor(() => {
    expect(apply).not.toBeDisabled();
  });

  const callsBefore = getSpy.mock.calls.length;
  await userEvent.click(apply);

  expect(onSubmit).toHaveBeenCalledWith(undefined);
  expect(onClose).toHaveBeenCalledTimes(1);
  // No extra API call for NO_TIME_RANGE — the button short-circuits
  expect(getSpy.mock.calls.length).toBe(callsBefore);
});

test('clearFilter via ref calls onSubmit(undefined)', async () => {
  const onSubmit = jest.fn();
  const ref = createRef<FilterHandler>();

  render(
    <TimeRangeFilter
      ref={ref}
      value={VALID_RANGE}
      onSubmit={onSubmit}
      onClose={jest.fn()}
    />,
  );

  act(() => {
    ref.current?.clearFilter();
  });

  expect(onSubmit).toHaveBeenCalledWith(undefined);
});
