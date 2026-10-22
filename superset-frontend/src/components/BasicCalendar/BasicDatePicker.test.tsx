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

function setup(
  mode: DatePickerMode = 'date',
  onChange = jest.fn(),
  initialValue = '2026-10-09T12:10:00',
) {
  function Harness() {
    const [value, setValue] = useState<Dayjs | null>(dayjs(initialValue));
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
  await userEvent.type(input, '11122026');
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
  await userEvent.type(input, '091020261435');
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

test.each([
  ['date', '__/__/____'],
  ['datetime', '__/__/____ __:__'],
] as const)(
  'keeps the %s mask visible when cleared and ignores non-digit keys',
  async (mode, mask) => {
    const { onChange } = setup(mode);
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    expect(input).toHaveValue(mask);
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(onChange).toHaveBeenLastCalledWith(null);
    await userEvent.type(input, 'ab/: -');
    expect(input).toHaveValue(mask);
    await userEvent.type(input, '09');
    expect(input).toHaveValue(`09${mask.slice(2)}`);
    expect(input).toHaveProperty('selectionStart', 3);
  },
);

test('Backspace and Delete clear digit slots without shifting the rest of the date or time', async () => {
  const { onChange } = setup('datetime');
  const input = screen.getByRole('textbox') as HTMLInputElement;
  await userEvent.click(input);
  onChange.mockClear();
  input.setSelectionRange(3, 3);
  await userEvent.keyboard('{Backspace}');
  expect(input).toHaveValue('0_/10/2026 12:10');
  expect(input.selectionStart).toBe(1);
  await userEvent.keyboard('9');
  expect(input).toHaveValue('09/10/2026 12:10');
  expect(input.selectionStart).toBe(3);
  input.setSelectionRange(13, 13);
  await userEvent.keyboard('{Delete}');
  expect(input).toHaveValue('09/10/2026 12:_0');
  expect(input.selectionStart).toBe(14);
  expect(input).toHaveAttribute('aria-invalid', 'true');
});

test('overwrites selected digits across separators and preserves the other segments', async () => {
  const { onChange } = setup('datetime');
  const input = screen.getByRole('textbox') as HTMLInputElement;
  await userEvent.click(input);
  input.setSelectionRange(0, 5);
  await userEvent.keyboard('1112');
  expect(input).toHaveValue('11/12/2026 12:10');
  expect(input.selectionStart).toBe(6);
  expect(onChange).toHaveBeenLastCalledWith('2026-12-11T12:10:00');
  input.setSelectionRange(10, 16);
  await userEvent.keyboard('{Backspace}');
  expect(input).toHaveValue('11/12/2026 __:__');
  await userEvent.keyboard('1435');
  expect(input).toHaveValue('11/12/2026 14:35');
  expect(onChange).toHaveBeenLastCalledWith('2026-12-11T14:35:00');
});

test.each(['111220261435', '11/12/2026 14:35', '2026-12-11T14:35:00'])(
  'pastes %s into the fixed date-time mask',
  async pasted => {
    const { onChange } = setup('datetime');
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await userEvent.click(input);
    input.setSelectionRange(0, input.value.length);
    fireEvent.paste(input, { clipboardData: { getData: () => pasted } });
    expect(input).toHaveValue('11/12/2026 14:35');
    expect(onChange).toHaveBeenLastCalledWith('2026-12-11T14:35:00');
    expect(input.selectionStart).toBe(16);
  },
);

test('cutting a selection clears its digits but leaves the fixed separators', async () => {
  setup('datetime');
  const input = screen.getByRole('textbox') as HTMLInputElement;
  await userEvent.click(input);
  input.setSelectionRange(0, input.value.length);
  const setData = jest.fn();
  fireEvent.cut(input, { clipboardData: { setData } });
  expect(setData).toHaveBeenCalledWith('text/plain', '09/10/2026 12:10');
  expect(input).toHaveValue('__/__/____ __:__');
  expect(input.selectionStart).toBe(0);
});

test('mobile input events preserve the mask and move past separators', async () => {
  const { onChange } = setup('datetime');
  const input = screen.getByRole('textbox') as HTMLInputElement;
  await userEvent.clear(input);
  onChange.mockClear();
  fireEvent.input(input, {
    target: { value: '0__/__/____ __:__', selectionStart: 1 },
    inputType: 'insertText',
    data: '0',
  });
  expect(input).toHaveValue('0_/__/____ __:__');
  fireEvent.input(input, {
    target: { value: '09_/__/____ __:__', selectionStart: 2 },
    inputType: 'insertText',
    data: '9',
  });
  expect(input).toHaveValue('09/__/____ __:__');
  expect(input.selectionStart).toBe(3);
  fireEvent.input(input, {
    target: { value: '09__/____ __:__', selectionStart: 2 },
    inputType: 'deleteContentBackward',
  });
  expect(input).toHaveValue('0_/__/____ __:__');
  expect(onChange).not.toHaveBeenCalled();
});

test('mobile deletion respects the caret even between repeated digits', async () => {
  setup();
  const input = screen.getByRole('textbox') as HTMLInputElement;
  await userEvent.clear(input);
  await userEvent.type(input, '11112026');
  fireEvent.input(input, {
    target: { value: '1/11/2026', selectionStart: 0 },
    inputType: 'deleteContentBackward',
  });
  expect(input).toHaveValue('_1/11/2026');
  expect(input.selectionStart).toBe(0);
});

test('non-digit mobile replacement leaves selected digits intact', async () => {
  setup();
  const input = screen.getByRole('textbox') as HTMLInputElement;
  fireEvent.input(input, {
    target: { value: 'a/10/2026', selectionStart: 1 },
    inputType: 'insertText',
    data: 'a',
  });
  expect(input).toHaveValue('09/10/2026');
});

test('the clear button leaves the mask ready for digit entry', async () => {
  const { onChange } = setup('datetime');
  await userEvent.click(screen.getByLabelText('Clear'));
  expect(screen.getByRole('textbox')).toHaveValue('__/__/____ __:__');
  expect(onChange).toHaveBeenLastCalledWith(null);
  await userEvent.keyboard('091020261435');
  expect(screen.getByRole('textbox')).toHaveValue('09/10/2026 14:35');
});

test('clearing a saved timestamp with seconds keeps the caret ready at the first digit', async () => {
  const onChange = jest.fn();
  setup('datetime', onChange, '2026-10-09T12:10:39');
  const input = screen.getByRole('textbox') as HTMLInputElement;
  expect(input).toHaveValue('09/10/2026 12:10:39');
  await userEvent.click(screen.getByLabelText('Clear'));
  expect(input).toHaveValue('__/__/____ __:__');
  expect(input.selectionStart).toBe(0);
  await userEvent.keyboard('091020261435');
  expect(input).toHaveValue('09/10/2026 14:35');
  expect(onChange).toHaveBeenLastCalledWith('2026-10-09T14:35:00');
});
