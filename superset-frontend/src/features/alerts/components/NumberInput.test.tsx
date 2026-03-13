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
import NumberInput from './NumberInput';

const defaultProps = {
  timeUnit: 'seconds',
  min: 0,
  name: 'timeout',
  value: '30',
  placeholder: 'Enter value',
  onChange: jest.fn(),
};

test('renders value with timeUnit suffix when not focused', () => {
  render(<NumberInput {...defaultProps} />);
  const input = screen.getByPlaceholderText('Enter value');
  expect(input).toHaveValue('30 seconds');
});

test('strips suffix on focus and restores on blur', () => {
  render(<NumberInput {...defaultProps} />);
  const input = screen.getByPlaceholderText('Enter value');

  fireEvent.focus(input);
  expect(input).toHaveValue('30');

  fireEvent.blur(input);
  expect(input).toHaveValue('30 seconds');
});

test('renders empty string when value is falsy', () => {
  render(<NumberInput {...defaultProps} value="" />);
  const input = screen.getByPlaceholderText('Enter value');
  expect(input).toHaveValue('');
});

test('renders empty string when value is zero', () => {
  render(<NumberInput {...defaultProps} value={0} />);
  const input = screen.getByPlaceholderText('Enter value');
  expect(input).toHaveValue('');
});

test('calls onChange when input changes', () => {
  const onChange = jest.fn();
  render(<NumberInput {...defaultProps} onChange={onChange} />);
  const input = screen.getByPlaceholderText('Enter value');

  fireEvent.change(input, { target: { value: '60' } });
  expect(onChange).toHaveBeenCalled();
});
