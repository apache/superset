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
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import { CommonFrame } from '../components/CommonFrame';
import { COMMON_RANGE_OPTIONS } from '../utils/constants';

test('renders section title', () => {
  render(<CommonFrame onChange={jest.fn()} value="Last week" />);
  expect(
    screen.getByText('Configure Time Range: Last...'),
  ).toBeInTheDocument();
});

test('renders all preset radio options plus the Other option', () => {
  render(<CommonFrame onChange={jest.fn()} value="Last week" />);
  const radios = screen.getAllByRole('radio');
  // presets + 1 "Other" row
  expect(radios).toHaveLength(COMMON_RANGE_OPTIONS.length + 1);
});

test('selects the matching preset radio when value is a preset', () => {
  render(<CommonFrame onChange={jest.fn()} value="Last month" />);
  const radio = screen.getByLabelText('Last month') as HTMLInputElement;
  expect(radio.checked).toBe(true);
});

test('calls onChange with the clicked preset value', () => {
  const onChange = jest.fn();
  render(<CommonFrame onChange={onChange} value="Last week" />);
  fireEvent.click(screen.getByLabelText('Last year'));
  expect(onChange).toHaveBeenCalledWith('Last year');
});

test('defaults to Last week when value does not match any known range', () => {
  const onChange = jest.fn();
  render(<CommonFrame onChange={onChange} value="some-invalid-value" />);
  expect(onChange).toHaveBeenCalledWith('Last week');
});

test('selects Other radio and emits a non-preset value when Other is clicked', () => {
  const onChange = jest.fn();
  render(<CommonFrame onChange={onChange} value="Last week" />);

  // Find the "Other" radio by its position (last radio)
  const radios = screen.getAllByRole('radio');
  const otherRadio = radios[radios.length - 1];
  fireEvent.click(otherRadio);

  // Should emit a "Last N unit" string that is NOT a preset
  const emitted = onChange.mock.calls[onChange.mock.calls.length - 1][0] as string;
  expect(emitted).toMatch(/^Last \d+ \w+s?$/i);
  // Must not be one of the hardcoded presets
  const presetValues = COMMON_RANGE_OPTIONS.map(o => o.value as string);
  expect(presetValues).not.toContain(emitted);
});

test('Other radio is pre-selected when value is a non-preset custom range', () => {
  render(<CommonFrame onChange={jest.fn()} value="Last 4 hours" />);
  const radios = screen.getAllByRole('radio');
  const otherRadio = radios[radios.length - 1] as HTMLInputElement;
  expect(otherRadio.checked).toBe(true);
});

test('Other inputs are disabled when a preset is selected', () => {
  render(<CommonFrame onChange={jest.fn()} value="Last week" />);
  const numberInput = screen.getByRole('spinbutton');
  expect(numberInput).toBeDisabled();
});

test('Other inputs are enabled when Other is selected', () => {
  render(<CommonFrame onChange={jest.fn()} value="Last 4 hours" />);
  const numberInput = screen.getByRole('spinbutton');
  expect(numberInput).not.toBeDisabled();
});

test('changing the number input emits an updated Last N unit string', () => {
  const onChange = jest.fn();
  render(<CommonFrame onChange={onChange} value="Last 4 hours" />);

  const numberInput = screen.getByRole('spinbutton');
  fireEvent.change(numberInput, { target: { value: '8' } });

  // The last call should contain 8 hours
  const calls = onChange.mock.calls.map(c => c[0] as string);
  const lastCall = calls[calls.length - 1];
  expect(lastCall).toMatch(/Last 8 hours?/i);
});
