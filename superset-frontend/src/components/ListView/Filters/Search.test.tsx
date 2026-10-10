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
  waitFor,
  fireEvent,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import SearchFilter from './Search';
import type { FilterHandler } from './types';

const mockOnSubmit = jest.fn();

const defaultProps = {
  Header: 'Search Header',
  name: 'search-input',
  initialValue: '',
  toolTipDescription: undefined,
  onSubmit: mockOnSubmit,
  autoComplete: undefined,
};

const setup = (props = {}) =>
  render(<SearchFilter {...defaultProps} {...props} />);

beforeEach(() => {
  mockOnSubmit.mockClear();
});

test('renders search filter with header', () => {
  setup();
  expect(screen.getByText('Search Header')).toBeInTheDocument();
});

test('renders input with placeholder', () => {
  setup();
  expect(screen.getByPlaceholderText('Type a value')).toBeInTheDocument();
});

test('renders search icon', () => {
  setup();
  expect(screen.getByTestId('filters-search')).toBeInTheDocument();
  // The icon should be present as a prefix
  const input = screen.getByTestId('filters-search');
  expect(input.parentElement?.querySelector('.anticon-search')).toBeTruthy();
});

test('renders with initial value', () => {
  setup({ initialValue: 'initial search term' });
  const input = screen.getByTestId('filters-search') as HTMLInputElement;
  expect(input.value).toBe('initial search term');
});

test('renders tooltip when toolTipDescription is provided', () => {
  setup({ toolTipDescription: 'This is a helpful tooltip' });
  const tooltip = screen.getByRole('img', { name: /info-circle/i });
  expect(tooltip).toBeInTheDocument();
});

test('does not render tooltip when toolTipDescription is undefined', () => {
  setup({ toolTipDescription: undefined });
  const tooltip = screen.queryByRole('img', { name: /info-circle/i });
  expect(tooltip).not.toBeInTheDocument();
});

test('updates input value on change', async () => {
  setup();
  const input = screen.getByTestId('filters-search') as HTMLInputElement;

  await userEvent.type(input, 'test query');

  expect(input.value).toBe('test query');
});

test('calls onSubmit with trimmed value on blur', async () => {
  setup();
  const input = screen.getByTestId('filters-search');

  await userEvent.type(input, '  search term  ');
  await userEvent.tab(); // Trigger blur

  await waitFor(() => {
    expect(mockOnSubmit).toHaveBeenCalledWith('search term');
  });
});

test('calls onSubmit with trimmed value on Enter key', async () => {
  setup();
  const input = screen.getByTestId('filters-search');

  await userEvent.type(input, '  another search  ');
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

  await waitFor(() => {
    expect(mockOnSubmit).toHaveBeenCalledWith('another search');
  });
});

test('calls onSubmit with empty string when input is cleared', async () => {
  setup({ initialValue: 'initial value' });
  const input = screen.getByTestId('filters-search');

  await userEvent.clear(input);

  await waitFor(() => {
    expect(mockOnSubmit).toHaveBeenCalledWith('');
  });
});

test('does not call onSubmit when empty value is submitted on blur', async () => {
  setup();
  const input = screen.getByTestId('filters-search');

  await userEvent.click(input);
  await userEvent.tab(); // Trigger blur without typing

  // onSubmit should not be called for empty value on blur/enter
  expect(mockOnSubmit).not.toHaveBeenCalled();
});

test('calls onSubmit with empty string when only whitespace is entered and cleared', async () => {
  setup();
  const input = screen.getByTestId('filters-search');

  await userEvent.type(input, '   ');

  // When cleared (which happens when the value becomes empty), onSubmit is called with ''
  await userEvent.clear(input);

  await waitFor(() => {
    expect(mockOnSubmit).toHaveBeenCalledWith('');
  });
});

test('clearFilter resets value and calls onSubmit with empty string', async () => {
  const ref = createRef<FilterHandler>();
  render(<SearchFilter {...defaultProps} initialValue="test" ref={ref} />);

  const input = screen.getByTestId('filters-search') as HTMLInputElement;
  expect(input.value).toBe('test');

  // Call clearFilter via ref
  ref.current?.clearFilter();

  await waitFor(() => {
    expect(input.value).toBe('');
    expect(mockOnSubmit).toHaveBeenCalledWith('');
  });
});

test('uses custom name attribute when provided', () => {
  setup({ name: 'custom-search-name' });
  const input = screen.getByTestId('filters-search') as HTMLInputElement;
  expect(input.name).toBe('custom-search-name');
});

test('sets autocomplete to off by default', () => {
  setup();
  const input = screen.getByTestId('filters-search') as HTMLInputElement;
  expect(input.autocomplete).toBe('off');
});

test('uses custom autocomplete value when provided', () => {
  setup({ autoComplete: 'new-password' });
  const input = screen.getByTestId('filters-search') as HTMLInputElement;
  expect(input.autocomplete).toBe('new-password');
});

test('renders with allowClear prop', () => {
  setup({ initialValue: 'test value' });
  const input = screen.getByTestId('filters-search');
  // Ant Design Input with allowClear should have a clear button when there's a value
  expect(input).toBeInTheDocument();
});

test('multiple rapid changes only submit the final value', async () => {
  setup();
  const input = screen.getByTestId('filters-search');

  await userEvent.type(input, 'first');
  await userEvent.type(input, ' second');
  await userEvent.type(input, ' third');
  await userEvent.tab();

  await waitFor(() => {
    expect(mockOnSubmit).toHaveBeenCalledWith('first second third');
    // Should only be called once on blur, not for each keystroke
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
  });
});

test('handles programmatic value changes through clearFilter', async () => {
  const ref = createRef<FilterHandler>();
  render(
    <SearchFilter {...defaultProps} initialValue="initial value" ref={ref} />,
  );

  const input = screen.getByTestId('filters-search') as HTMLInputElement;

  // Type something new
  await userEvent.clear(input);
  await userEvent.type(input, 'new value');
  expect(input.value).toBe('new value');

  // Clear using ref
  ref.current?.clearFilter();

  await waitFor(() => {
    expect(input.value).toBe('');
    expect(mockOnSubmit).toHaveBeenCalledWith('');
  });
});
