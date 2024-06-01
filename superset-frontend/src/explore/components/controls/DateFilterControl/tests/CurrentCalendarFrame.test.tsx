import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect'; // For advanced DOM assertions
import { CurrentCalendarFrame } from '../components/CurrentCalendarFrame';
import { CurrentWeek } from '../types';

const mockOnChange = jest.fn();

test('calls onChange(CurrentWeek) when value is invalid', () => {
  render(<CurrentCalendarFrame onChange={mockOnChange} value="InvalidValue" />);
  expect(mockOnChange).toHaveBeenCalledWith(CurrentWeek);
});

test('returns null if value is not a valid CurrentRangeType', () => {
  const { container } = render(
    <CurrentCalendarFrame onChange={mockOnChange} value="InvalidValue" />,
  );
  expect(container.firstChild).toBeNull();
});
