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
import { Dayjs } from 'dayjs';
import {
  render,
  screen,
  userEvent,
  fireEvent,
} from 'spec/helpers/testing-library';
import { extendedDayjs as dayjs } from '@superset-ui/core/utils/dates';
import BasicDatePicker from './BasicDatePicker';
import {
  DatePickerMode,
  parseTypedDate,
  decodeDateTimeRange,
  encodeDateTimeRange,
} from './utils';

function setup(mode: DatePickerMode = 'date', onChange = jest.fn()) {
  function Harness() {
    const [value, setValue] = useState<Dayjs | null>(
      dayjs('2026-10-09T12:10:00'),
    );
    return (
      <BasicDatePicker
        label="Planned start"
        mode={mode}
        value={value}
        onChange={date => {
          setValue(date);
          onChange(date?.format('YYYY-MM-DDTHH:mm:ss') ?? null);
        }}
      />
    );
  }
  return { ...render(<Harness />), onChange };
}

test('clicking the text focuses an editable field without opening a picker', async () => {
  const { onChange } = setup();
  const input = screen.getByRole('textbox', { name: 'Planned start' });
  await userEvent.click(input);
  expect(input).toHaveFocus();
  expect(
    screen.queryByTestId('basic-date-picker-popup'),
  ).not.toBeInTheDocument();
  await userEvent.clear(input);
  await userEvent.type(input, '11/12/2026');
  expect(input).toHaveValue('11/12/2026');
  expect(onChange).toHaveBeenLastCalledWith('2026-12-11T00:00:00');
  expect(
    screen.queryByTestId('basic-date-picker-popup'),
  ).not.toBeInTheDocument();
});

test('only the icon opens the calendar; selecting a day returns to typing', async () => {
  setup();
  await userEvent.clear(screen.getByRole('textbox'));
  await userEvent.type(screen.getByRole('textbox'), '03/10/2026');
  await userEvent.click(
    screen.getByRole('button', { name: 'Open picker for Planned start' }),
  );
  expect(screen.getByTestId('basic-date-picker-popup')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '2026-10-09' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await userEvent.click(screen.getByRole('button', { name: '2026-10-15' }));
  expect(
    screen.queryByTestId('basic-date-picker-popup'),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue('15/10/2026');
  expect(screen.getByRole('textbox')).toHaveFocus();
});

test('date-time fields accept manual minute precision without opening the picker', async () => {
  const { onChange } = setup('datetime');
  const input = screen.getByRole('textbox');
  await userEvent.clear(input);
  await userEvent.type(input, '09/10/2026 14:35');
  expect(input).toHaveValue('09/10/2026 14:35');
  expect(onChange).toHaveBeenLastCalledWith('2026-10-09T14:35:00');
  expect(
    screen.queryByTestId('basic-date-picker-popup'),
  ).not.toBeInTheDocument();
});

test('calendar and time columns commit together only when Done is clicked', async () => {
  const { onChange } = setup('datetime');
  await userEvent.click(
    screen.getByRole('button', { name: 'Open picker for Planned start' }),
  );
  await userEvent.click(screen.getByRole('button', { name: '2026-10-11' }));
  await userEvent.click(screen.getByRole('button', { name: 'Hour 16' }));
  await userEvent.click(screen.getByRole('button', { name: 'Minute 25' }));
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(onChange).toHaveBeenLastCalledWith('2026-10-11T16:25:00');
  expect(screen.getByRole('textbox')).toHaveValue('11/10/2026 16:25');
});

test('partial and impossible text is preserved on blur without committing a date', async () => {
  const { onChange } = setup();
  const input = screen.getByRole('textbox');
  await userEvent.clear(input);
  onChange.mockClear();
  await userEvent.type(input, '31/02/2026');
  fireEvent.blur(input);
  expect(input).toHaveValue('31/02/2026');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(onChange).not.toHaveBeenCalled();
  expect(
    screen.queryByTestId('basic-date-picker-popup'),
  ).not.toBeInTheDocument();
});

test('Arrow Down opens the picker and Escape closes it without changing text', async () => {
  setup();
  const input = screen.getByRole('textbox');
  await userEvent.click(input);
  await userEvent.keyboard('{ArrowDown}');
  expect(screen.getByTestId('basic-date-picker-popup')).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(
    screen.queryByTestId('basic-date-picker-popup'),
  ).not.toBeInTheDocument();
  expect(input).toHaveValue('09/10/2026');
});

test.each(['31/02/2026', '29/02/2025', '09/10/20', '10/13/2026'])(
  'rejects invalid date %s',
  text => {
    expect(parseTypedDate(text, 'date')).toBeNull();
  },
);

test('keeps leap days and exact date-time bounds without adding an extra day', () => {
  expect(parseTypedDate('29/02/2024', 'date')?.format('YYYY-MM-DD')).toBe(
    '2024-02-29',
  );
  const [start, end] = decodeDateTimeRange(
    '2026-10-09T12:10:00 : 2026-10-09T16:25:00',
  );
  expect(start && end && encodeDateTimeRange(start, end)).toBe(
    '2026-10-09T12:10:00 : 2026-10-09T16:25:00',
  );
  expect(parseTypedDate('09/10/2026 24:01', 'datetime')).toBeNull();
});
