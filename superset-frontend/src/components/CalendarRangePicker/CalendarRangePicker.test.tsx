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
import {
  render,
  screen,
  fireEvent,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { NO_TIME_RANGE } from '@superset-ui/core';
import {
  CalendarRangePicker,
  parseSingleDate,
  parseRangeValue,
  formatRangeValue,
  DEFAULT_DATE_FORMAT,
} from './index';

describe('CalendarRangePicker Component', () => {
  // Case 1: Default Empty Rendering
  test('renders with default empty state and data-test attribute', () => {
    const { container } = render(<CalendarRangePicker onChange={jest.fn()} />);
    expect(container).toBeInTheDocument();
    expect(screen.getByTestId('calendar-range-picker')).toBeInTheDocument();

    const startInput = screen.getByPlaceholderText('Start date');
    const endInput = screen.getByPlaceholderText('End date');
    expect(startInput).toHaveValue('');
    expect(endInput).toHaveValue('');
  });

  // Case 2: Initial Canonical Range Rendering
  test('renders with initial canonical range string', () => {
    render(
      <CalendarRangePicker
        value="2026-11-01 : 2026-11-30"
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByPlaceholderText('Start date')).toHaveValue('2026-11-01');
    expect(screen.getByPlaceholderText('End date')).toHaveValue('2026-11-30');
  });

  // Case 3: Initial Open-Ended Ranges Rendering
  test('renders open-ended range without start date', () => {
    render(<CalendarRangePicker value=" : 2026-11-30" onChange={jest.fn()} />);
    expect(screen.getByPlaceholderText('Start date')).toHaveValue('');
    expect(screen.getByPlaceholderText('End date')).toHaveValue('2026-11-30');
  });

  test('renders open-ended range without end date', () => {
    render(<CalendarRangePicker value="2026-11-01 : " onChange={jest.fn()} />);
    expect(screen.getByPlaceholderText('Start date')).toHaveValue('2026-11-01');
    expect(screen.getByPlaceholderText('End date')).toHaveValue('');
  });

  // Case 4: ISO Datetime Range Rendering
  test('renders ISO datetime strings and formats them to date display', () => {
    render(
      <CalendarRangePicker
        value="2026-11-01T00:00:00 : 2026-11-30T23:59:59"
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByPlaceholderText('Start date')).toHaveValue('2026-11-01');
    expect(screen.getByPlaceholderText('End date')).toHaveValue('2026-11-30');
  });

  // Case 5: Date Change Emits Formatted Range with inclusiveEndDate default true
  test('emits formatted range with inclusive end date by default', async () => {
    const onChange = jest.fn();
    render(<CalendarRangePicker onChange={onChange} />);

    const startInput = screen.getByPlaceholderText('Start date');
    const endInput = screen.getByPlaceholderText('End date');

    fireEvent.change(startInput, { target: { value: '2026-12-01' } });
    fireEvent.keyDown(startInput, { key: 'Enter', code: 'Enter' });

    fireEvent.change(endInput, { target: { value: '2026-12-31' } });
    fireEvent.keyDown(endInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('2026-12-01 : 2026-12-31T23:59:59');
    });
  });

  // Case 6: Date Change Emits Formatted Range without time when inclusiveEndDate is false
  test('emits formatted range without time when inclusiveEndDate is false', async () => {
    const onChange = jest.fn();
    render(
      <CalendarRangePicker inclusiveEndDate={false} onChange={onChange} />,
    );

    const startInput = screen.getByPlaceholderText('Start date');
    const endInput = screen.getByPlaceholderText('End date');

    fireEvent.change(startInput, { target: { value: '2026-12-01' } });
    fireEvent.keyDown(startInput, { key: 'Enter', code: 'Enter' });

    fireEvent.change(endInput, { target: { value: '2026-12-31' } });
    fireEvent.keyDown(endInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('2026-12-01 : 2026-12-31');
    });
  });

  // Case 7: Clear Range Emits Empty String
  test('emits empty string when range is cleared via clear icon', async () => {
    const onChange = jest.fn();
    const { container } = render(
      <CalendarRangePicker
        value="2026-11-01 : 2026-11-30"
        onChange={onChange}
        allowClear
      />,
    );

    const picker = container.querySelector('.ant-picker');
    expect(picker).toBeInTheDocument();
    await userEvent.hover(picker!);

    const clearButton = container.querySelector('.ant-picker-clear');
    expect(clearButton).toBeInTheDocument();
    fireEvent.mouseDown(clearButton!);
    fireEvent.click(clearButton!);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  // Case 8: Disabled State
  test('renders inputs with disabled attribute when disabled is true', () => {
    const { container } = render(
      <CalendarRangePicker
        disabled
        value="2026-11-01 : 2026-11-30"
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByPlaceholderText('Start date')).toBeDisabled();
    expect(screen.getByPlaceholderText('End date')).toBeDisabled();
    expect(container.querySelector('.ant-picker-disabled')).toBeInTheDocument();
  });

  // Case 9: Malformed Value Fallback
  test('gracefully handles malformed or invalid value strings without throwing', () => {
    const malformedValues = [
      'invalid-date',
      'foo : bar',
      '2026-99-99 : 2026-88-88',
      '2026-02-31',
      ':',
      ':::',
      ' : ',
      ': : :',
      ': 2026-11-01 :',
    ];

    malformedValues.forEach(badVal => {
      const { unmount } = render(
        <CalendarRangePicker value={badVal} onChange={jest.fn()} />,
      );
      const startInput = screen.getByPlaceholderText('Start date');
      const endInput = screen.getByPlaceholderText('End date');
      expect(startInput).toHaveValue('');
      expect(endInput).toHaveValue('');
      unmount();
    });
  });

  // Case 10: NO_TIME_RANGE Handling
  test('treats NO_TIME_RANGE as empty range', () => {
    render(<CalendarRangePicker value={NO_TIME_RANGE} onChange={jest.fn()} />);
    expect(screen.getByPlaceholderText('Start date')).toHaveValue('');
    expect(screen.getByPlaceholderText('End date')).toHaveValue('');
  });

  // Case 11: Custom Format Support
  test('supports custom date formatting', () => {
    render(
      <CalendarRangePicker
        format="DD/MM/YYYY"
        value="01/11/2026 : 30/11/2026"
        onChange={jest.fn()}
      />,
    );
    expect(screen.getByPlaceholderText('Start date')).toHaveValue('01/11/2026');
    expect(screen.getByPlaceholderText('End date')).toHaveValue('30/11/2026');
  });
});

describe('CalendarRangePicker Utility Functions', () => {
  describe('parseSingleDate', () => {
    test('returns null for undefined, null, or empty string', () => {
      expect(parseSingleDate(undefined)).toBeNull();
      expect(parseSingleDate(null)).toBeNull();
      expect(parseSingleDate('')).toBeNull();
      expect(parseSingleDate('   ')).toBeNull();
    });

    test('parses valid date strings in default format', () => {
      const parsed = parseSingleDate('2026-11-01');
      expect(parsed).not.toBeNull();
      expect(parsed?.format('YYYY-MM-DD')).toBe('2026-11-01');
    });

    test('parses ISO timestamps with timezone offsets near midnight without false rollover', () => {
      const parsed = parseSingleDate('2026-11-01T23:30:00Z');
      expect(parsed).not.toBeNull();
      expect(parsed?.isValid()).toBe(true);
    });

    test('rejects calendar rollover dates in ISO strings', () => {
      expect(parseSingleDate('2026-02-31T00:00:00')).toBeNull();
      expect(parseSingleDate('2026-02-29T00:00:00')).toBeNull();
    });

    test('respects custom format parameter with fallback', () => {
      const customParsed = parseSingleDate('15/11/2026', 'DD/MM/YYYY');
      expect(customParsed).not.toBeNull();
      expect(customParsed?.format('YYYY-MM-DD')).toBe('2026-11-15');

      const fallbackParsed = parseSingleDate('2026-11-15', 'DD/MM/YYYY');
      expect(fallbackParsed).not.toBeNull();
      expect(fallbackParsed?.format('YYYY-MM-DD')).toBe('2026-11-15');
    });
  });

  describe('parseRangeValue', () => {
    test('returns null for undefined, null, empty string, or NO_TIME_RANGE', () => {
      expect(parseRangeValue(undefined)).toBeNull();
      expect(parseRangeValue(null)).toBeNull();
      expect(parseRangeValue('')).toBeNull();
      expect(parseRangeValue('   ')).toBeNull();
      expect(parseRangeValue(NO_TIME_RANGE)).toBeNull();
    });

    test('parses canonical date range string', () => {
      const result = parseRangeValue('2026-11-01 : 2026-11-30');
      expect(result).not.toBeNull();
      expect(result![0]?.format('YYYY-MM-DD')).toBe('2026-11-01');
      expect(result![1]?.format('YYYY-MM-DD')).toBe('2026-11-30');
    });

    test('parses ISO datetime strings and extracts dates', () => {
      const result = parseRangeValue(
        '2026-11-01T00:00:00 : 2026-11-30T23:59:59',
      );
      expect(result).not.toBeNull();
      expect(result![0]?.format('YYYY-MM-DD')).toBe('2026-11-01');
      expect(result![1]?.format('YYYY-MM-DD')).toBe('2026-11-30');
    });

    test('parses open-ended range without start date', () => {
      const result = parseRangeValue(' : 2026-11-30');
      expect(result).not.toBeNull();
      expect(result![0]).toBeNull();
      expect(result![1]?.format('YYYY-MM-DD')).toBe('2026-11-30');
    });

    test('parses open-ended range without end date', () => {
      const result = parseRangeValue('2026-11-01 : ');
      expect(result).not.toBeNull();
      expect(result![0]?.format('YYYY-MM-DD')).toBe('2026-11-01');
      expect(result![1]).toBeNull();
    });

    test('returns null for colon-only strings and invalid colon wrappers', () => {
      expect(parseRangeValue(':')).toBeNull();
      expect(parseRangeValue(':::')).toBeNull();
      expect(parseRangeValue(' : ')).toBeNull();
      expect(parseRangeValue(': : :')).toBeNull();
      expect(parseRangeValue(': 2026-11-01 :')).toBeNull();
    });

    test('returns null for completely invalid dates', () => {
      expect(parseRangeValue('not-a-date')).toBeNull();
      expect(parseRangeValue('foo : bar')).toBeNull();
    });

    test('handles single valid date by duplicating for both boundaries', () => {
      const result = parseRangeValue('2026-11-15');
      expect(result).not.toBeNull();
      expect(result![0]?.format('YYYY-MM-DD')).toBe('2026-11-15');
      expect(result![1]?.format('YYYY-MM-DD')).toBe('2026-11-15');
    });
  });

  describe('formatRangeValue', () => {
    test('formats a tuple of dayjs objects with canonical separator and inclusiveEndDate=false', () => {
      const start = extendedDayjs('2026-11-01');
      const end = extendedDayjs('2026-11-30');
      expect(formatRangeValue([start, end])).toBe('2026-11-01 : 2026-11-30');
    });

    test('formats end date with T23:59:59 when inclusiveEndDate=true', () => {
      const start = extendedDayjs('2026-11-01');
      const end = extendedDayjs('2026-11-30');
      expect(
        formatRangeValue([start, end], DEFAULT_DATE_FORMAT, '', true),
      ).toBe('2026-11-01 : 2026-11-30T23:59:59');
    });

    test('formats open-ended ranges preserving leading and trailing separators', () => {
      const start = extendedDayjs('2026-11-01');
      const end = extendedDayjs('2026-11-30');

      expect(formatRangeValue([null, end])).toBe(' : 2026-11-30');
      expect(formatRangeValue([null, end], DEFAULT_DATE_FORMAT, '', true)).toBe(
        ' : 2026-11-30T23:59:59',
      );
      expect(formatRangeValue([start, null])).toBe('2026-11-01 : ');
    });

    test('returns clearValue when dates is null or contains invalid dates', () => {
      expect(formatRangeValue(null)).toBe('');
      expect(formatRangeValue(null, 'YYYY-MM-DD', 'No filter')).toBe(
        'No filter',
      );
      expect(formatRangeValue([null, null])).toBe('');
    });

    test('respects custom format parameter', () => {
      const start = extendedDayjs('2026-11-01');
      const end = extendedDayjs('2026-11-30');
      expect(formatRangeValue([start, end], 'DD/MM/YYYY')).toBe(
        '01/11/2026 : 30/11/2026',
      );
    });
  });
});
