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
  parseRangeValue,
  formatRangeValue,
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

  // Case 3: Date Change Emits Formatted Range
  test('emits formatted range string when date range is selected', async () => {
    const onChange = jest.fn();
    render(<CalendarRangePicker onChange={onChange} />);

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

  // Case 4: Clear Range Emits Empty String
  test('emits empty string when range is cleared', async () => {
    const onChange = jest.fn();
    const { container } = render(
      <CalendarRangePicker
        value="2026-11-01 : 2026-11-30"
        onChange={onChange}
        allowClear
      />,
    );

    const clearButton = container.querySelector('.ant-picker-clear');
    if (clearButton) {
      await userEvent.click(clearButton);
      expect(onChange).toHaveBeenCalledWith('');
    } else {
      const startInput = screen.getByPlaceholderText('Start date');
      await userEvent.clear(startInput);
      fireEvent.keyDown(startInput, { key: 'Enter', code: 'Enter' });
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith('');
      });
    }
  });

  // Case 5: Disabled State
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

  // Case 6: Malformed Value Fallback
  test('gracefully handles malformed or invalid value strings without throwing', () => {
    const malformedValues = [
      'invalid-date',
      'foo : bar',
      '2026-99-99 : 2026-88-88',
      '2026-11-01 : ',
      ' : 2026-11-30',
      ': : :',
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

  // Case 7: NO_TIME_RANGE Handling
  test('treats NO_TIME_RANGE as empty range', () => {
    render(<CalendarRangePicker value={NO_TIME_RANGE} onChange={jest.fn()} />);
    expect(screen.getByPlaceholderText('Start date')).toHaveValue('');
    expect(screen.getByPlaceholderText('End date')).toHaveValue('');
  });

  // Case 8: Custom Format Support
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

    test('returns null for completely invalid dates', () => {
      expect(parseRangeValue('not-a-date')).toBeNull();
      expect(parseRangeValue('foo : bar')).toBeNull();
      expect(parseRangeValue(': : :')).toBeNull();
    });

    test('handles single valid date by duplicating for both boundaries', () => {
      const result = parseRangeValue('2026-11-15');
      expect(result).not.toBeNull();
      expect(result![0]?.format('YYYY-MM-DD')).toBe('2026-11-15');
      expect(result![1]?.format('YYYY-MM-DD')).toBe('2026-11-15');
    });
  });

  describe('formatRangeValue', () => {
    test('formats a tuple of dayjs objects with canonical separator', () => {
      const start = extendedDayjs('2026-11-01');
      const end = extendedDayjs('2026-11-30');
      expect(formatRangeValue([start, end])).toBe('2026-11-01 : 2026-11-30');
    });

    test('returns clearValue when dates is null or contains invalid dates', () => {
      expect(formatRangeValue(null)).toBe('');
      expect(formatRangeValue(null, 'YYYY-MM-DD', 'No filter')).toBe('No filter');
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
