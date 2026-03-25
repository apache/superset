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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import NumberControl from '.';

const mockedProps = {
  min: -5,
  max: 10,
  step: 1,
  default: 0,
};

test('render', () => {
  const { container } = render(<NumberControl {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('type number and blur triggers onChange', async () => {
  const props = {
    ...mockedProps,
    onChange: jest.fn(),
  };
  render(<NumberControl {...props} />);
  const input = screen.getByRole('spinbutton');
  userEvent.type(input, '9');
  userEvent.tab(); // Trigger blur to dispatch
  expect(props.onChange).toHaveBeenLastCalledWith(9);
});

test('type value exceeding max and blur', async () => {
  const props = {
    ...mockedProps,
    onChange: jest.fn(),
  };
  render(<NumberControl {...props} />);
  const input = screen.getByRole('spinbutton');
  userEvent.type(input, '20');
  userEvent.tab(); // Trigger blur to dispatch
  expect(props.onChange).toHaveBeenCalled();
});

test('type NaN keeps original value', async () => {
  const props = {
    ...mockedProps,
    value: 5,
    onChange: jest.fn(),
  };
  render(<NumberControl {...props} />);
  const input = screen.getByRole('spinbutton');
  userEvent.type(input, 'not a number');
  userEvent.tab(); // Trigger blur

  expect(props.onChange).toHaveBeenLastCalledWith(5);
});

test('can clear field completely', async () => {
  const props = {
    ...mockedProps,
    value: 10,
    onChange: jest.fn(),
  };
  render(<NumberControl {...props} />);
  const input = screen.getByRole('spinbutton');
  userEvent.clear(input);
  userEvent.tab(); // Trigger blur
  expect(props.onChange).toHaveBeenLastCalledWith(undefined);
});

test('updates local value when prop changes', () => {
  const props = {
    ...mockedProps,
    value: 5,
    onChange: jest.fn(),
  };
  const { rerender } = render(<NumberControl {...props} />);
  const input = screen.getByRole('spinbutton');
  expect(input).toHaveValue('5');

  rerender(<NumberControl {...props} value={8} />);
  expect(input).toHaveValue('8');
});
