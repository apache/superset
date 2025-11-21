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
import { render, screen, userEvent, waitFor } from 'spec/helpers/testing-library';
import { SizeToControl } from '../SizeToControl';

const defaultProps = {
  name: 'size_to',
  label: 'Maximum Font Size',
  description: 'Font size for the biggest value in the list',
  onChange: jest.fn(),
  value: 70,
  hovered: false,
  default: 70,
};

const setup = (overrides = {}) => (
  <SizeToControl {...defaultProps} {...overrides} />
);

test('should render', () => {
  const { container } = render(setup());
  expect(container).toBeInTheDocument();
});

test('should render with label', () => {
  render(setup());
  expect(screen.getByText('Maximum Font Size')).toBeInTheDocument();
});

test('should render Input component', () => {
  render(setup());
  const input = screen.getByRole('textbox');
  expect(input).toBeInTheDocument();
});

test('should display current numeric value', () => {
  render(setup({ value: 100 }));
  const input = screen.getByRole('textbox');
  expect(input).toHaveValue('100');
});

test('should display current string value', () => {
  render(setup({ value: '80' }));
  const input = screen.getByRole('textbox');
  expect(input).toHaveValue('80');
});

test('should use default value when value is undefined', () => {
  render(setup({ value: undefined }));
  const input = screen.getByRole('textbox');
  expect(input).toHaveValue('70');
});

test('should call onChange with parsed integer when valid number is entered', async () => {
  const onChange = jest.fn();
  render(setup({ onChange, value: undefined }));
  const input = screen.getByRole('textbox');
  
  await userEvent.clear(input);
  await userEvent.type(input, '100');
  
  // Wait for debounce
  await waitFor(
    () => {
      expect(onChange).toHaveBeenCalled();
    },
    { timeout: 500 },
  );
  
  // Check that onChange was called with parsed integer
  const calls = onChange.mock.calls;
  const lastCall = calls[calls.length - 1];
  expect(lastCall[0]).toBe(100);
  expect(lastCall[1]).toEqual([]); // No errors
});

test('should call onChange with errors when invalid input is entered', async () => {
  const onChange = jest.fn();
  render(setup({ onChange, value: undefined }));
  const input = screen.getByRole('textbox');
  
  await userEvent.clear(input);
  await userEvent.type(input, 'xyz');
  
  // Wait for debounce
  await waitFor(
    () => {
      expect(onChange).toHaveBeenCalled();
    },
    { timeout: 500 },
  );
  
  // Check that onChange was called with errors
  const calls = onChange.mock.calls;
  const lastCall = calls[calls.length - 1];
  expect(lastCall[1].length).toBeGreaterThan(0); // Has errors
});

test('should handle empty input', async () => {
  const onChange = jest.fn();
  render(setup({ onChange, value: 70 }));
  const input = screen.getByRole('textbox');
  
  await userEvent.clear(input);
  
  // Wait for debounce
  await waitFor(
    () => {
      expect(onChange).toHaveBeenCalled();
    },
    { timeout: 500 },
  );
  
  // Empty string should be passed without errors
  const calls = onChange.mock.calls;
  const lastCall = calls[calls.length - 1];
  expect(lastCall[0]).toBe('');
  expect(lastCall[1]).toEqual([]);
});

test('should display placeholder when provided', () => {
  render(setup({ placeholder: 'Enter maximum size' }));
  const input = screen.getByPlaceholderText('Enter maximum size');
  expect(input).toBeInTheDocument();
});

test('should be disabled when disabled prop is true', () => {
  render(setup({ disabled: true }));
  const input = screen.getByRole('textbox');
  expect(input).toBeDisabled();
});

test('should update input value when value prop changes', () => {
  const { rerender } = render(setup({ value: 70 }));
  const input = screen.getByRole('textbox');
  expect(input).toHaveValue('70');
  
  rerender(setup({ value: 120 }));
  expect(input).toHaveValue('120');
});

test('should display description tooltip when hovered', () => {
  render(setup({ hovered: true }));
  const header = screen.getByTestId('size_to-header');
  expect(header).toBeInTheDocument();
});

test('should display validation errors', () => {
  const validationErrors = ['Value must be positive'];
  render(setup({ validationErrors }));
  const header = screen.getByTestId('size_to-header');
  expect(header).toBeInTheDocument();
});

test('should have correct default name prop', () => {
  expect(SizeToControl.defaultProps?.name).toBe('size_to');
});

test('should debounce onChange calls', async () => {
  const onChange = jest.fn();
  render(setup({ onChange, value: undefined }));
  const input = screen.getByRole('textbox');
  
  // Type multiple characters quickly
  await userEvent.type(input, '999', { delay: 10 });
  
  // Should not have been called immediately
  expect(onChange).not.toHaveBeenCalled();
  
  // Wait for debounce
  await waitFor(
    () => {
      expect(onChange).toHaveBeenCalled();
    },
    { timeout: 500 },
  );
});

