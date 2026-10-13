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
import { useState } from 'react';
import {
  render,
  screen,
  userEvent,
  fireEvent,
} from 'spec/helpers/testing-library';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import BasicCalendar from '.';
import { decodeCalendarRange, encodeCalendarRange } from './utils';

test('a selection includes the whole end date across month and year boundaries', () => {
  expect(encodeCalendarRange(dayjs('2025-12-30'), dayjs('2026-01-02'))).toBe(
    '2025-12-30 : 2026-01-03',
  );
  const [start, end] = decodeCalendarRange('2024-02-28 : 2024-03-01');
  expect(start?.format('YYYY-MM-DD')).toBe('2024-02-28');
  expect(end?.format('YYYY-MM-DD')).toBe('2024-02-29');
});

test.each([
  'Last week',
  'No filter',
  'today : tomorrow',
  '2026-10-01T12:00:00 : 2026-10-02T12:00:00',
  '2026-10-02 : 2026-10-01',
])('keeps unsupported range %s out of day selection', value => {
  expect(decodeCalendarRange(value)).toEqual([null, null]);
});

test('selects and orders dates in reverse, blocking an incomplete selection', async () => {
  const onChange = jest.fn();
  const onValidityChange = jest.fn();
  render(
    <BasicCalendar
      value="2026-09-01 : 2026-09-08"
      onChange={onChange}
      onValidityChange={onValidityChange}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: '2026-10-05' }));
  expect(onValidityChange).toHaveBeenLastCalledWith(false);
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: '2026-09-28' }));
  expect(onValidityChange).toHaveBeenLastCalledWith(true);
  expect(onChange).toHaveBeenCalledWith('2026-09-28 : 2026-10-06');
});

test('a single day is included and clearing an endpoint blocks applying', async () => {
  const onChange = jest.fn();
  const onValidityChange = jest.fn();
  render(
    <BasicCalendar
      value="2026-10-01 : 2026-10-08"
      onChange={onChange}
      onValidityChange={onValidityChange}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: '2026-10-04' }));
  await userEvent.click(screen.getByRole('button', { name: '2026-10-04' }));
  expect(onChange).toHaveBeenCalledWith('2026-10-04 : 2026-10-05');
  fireEvent.click(screen.getAllByRole('button', { name: 'Clear' })[0]);
  expect(onValidityChange).toHaveBeenLastCalledWith(false);
});

test('keeps quick ranges relative and restores All time after a partial selection', async () => {
  const onValidityChange = jest.fn();
  function Harness() {
    const [value, setValue] = useState('2026-10-01 : 2026-10-08');
    return (
      <BasicCalendar
        value={value}
        onChange={setValue}
        onValidityChange={onValidityChange}
      />
    );
  }
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: '2026-10-04' }));
  await userEvent.click(screen.getByRole('button', { name: 'All time' }));
  expect(onValidityChange).toHaveBeenLastCalledWith(true);
  expect(
    screen.getByText('All available dates are included.'),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Start date')).toHaveValue('');
  await userEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
  expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('arrow keys move focus across a month boundary', () => {
  render(
    <BasicCalendar
      value="2026-09-30 : 2026-10-02"
      onChange={jest.fn()}
      onValidityChange={jest.fn()}
    />,
  );
  fireEvent.keyDown(screen.getByRole('button', { name: '2026-09-30' }), {
    key: 'ArrowRight',
  });
  expect(screen.getByRole('button', { name: '2026-10-01' })).toHaveFocus();
});

test('both manual endpoints are editable and dates include the end day', async () => {
  const onChange = jest.fn();
  const onValidityChange = jest.fn();
  render(
    <BasicCalendar
      value="2026-10-01 : 2026-10-08"
      onChange={onChange}
      onValidityChange={onValidityChange}
    />,
  );
  const start = screen.getByRole('textbox', { name: 'Start date' });
  await userEvent.clear(start);
  await userEvent.type(start, '03/10/2026');
  expect(onChange).toHaveBeenLastCalledWith('2026-10-03 : 2026-10-08');
  expect(
    screen.queryByTestId('basic-date-picker-popup'),
  ).not.toBeInTheDocument();
  await userEvent.clear(start);
  await userEvent.type(start, '31/02/2026');
  const end = screen.getByRole('textbox', { name: 'End date' });
  await userEvent.clear(end);
  await userEvent.type(end, '09/10/2026');
  expect(onValidityChange).toHaveBeenLastCalledWith(false);
});

test('date-time range keeps entered times and supports relative hour shortcuts', async () => {
  const onChange = jest.fn();
  render(
    <BasicCalendar
      value="2026-10-09T12:10:00 : 2026-10-09T16:25:00"
      onChange={onChange}
      onValidityChange={jest.fn()}
    />,
  );
  expect(
    screen.getByRole('textbox', { name: 'Start date and time' }),
  ).toHaveValue('09/10/2026 12:10');
  const end = screen.getByRole('textbox', { name: 'End date and time' });
  await userEvent.clear(end);
  await userEvent.type(end, '09/10/2026 18:45');
  expect(onChange).toHaveBeenLastCalledWith(
    '2026-10-09T12:10:00 : 2026-10-09T18:45:00',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Last 4 hours' }));
  expect(onChange).toHaveBeenLastCalledWith('Last 4 hours');
});
