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
import VerticalRadioControl from './VerticalRadioControl';

const options: [string, string][] = [
  ['a', 'Option A'],
  ['b', 'Option B'],
];

test('renders one radio per option using tuple options', () => {
  render(<VerticalRadioControl options={options} onChange={jest.fn()} />);
  expect(screen.getAllByRole('radio')).toHaveLength(2);
  expect(screen.getByText('Option A')).toBeInTheDocument();
  expect(screen.getByText('Option B')).toBeInTheDocument();
});

test('selects the first option when no value is provided', () => {
  render(<VerticalRadioControl options={options} onChange={jest.fn()} />);
  expect(screen.getByRole('radio', { name: 'Option A' })).toBeChecked();
});

test('selects the option matching the value', () => {
  render(
    <VerticalRadioControl value="b" options={options} onChange={jest.fn()} />,
  );
  expect(screen.getByRole('radio', { name: 'Option B' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Option A' })).not.toBeChecked();
});

test('calls onChange with the clicked option value', async () => {
  const onChange = jest.fn();
  render(
    <VerticalRadioControl value="a" options={options} onChange={onChange} />,
  );
  await userEvent.click(screen.getByRole('radio', { name: 'Option B' }));
  expect(onChange).toHaveBeenCalledWith('b');
});

test('supports object options and disables options flagged disabled', () => {
  const onChange = jest.fn();
  render(
    <VerticalRadioControl
      value="a"
      options={[
        { value: 'a', label: 'Option A' },
        { value: 'b', label: 'Option B', disabled: true },
      ]}
      onChange={onChange}
    />,
  );
  expect(screen.getByRole('radio', { name: 'Option B' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: 'Option A' })).toBeEnabled();
});

test('renders a tooltip icon for options with a tooltip', () => {
  render(
    <VerticalRadioControl
      options={[
        { value: 'a', label: 'Option A', tooltip: 'More info' },
        { value: 'b', label: 'Option B' },
      ]}
      onChange={jest.fn()}
    />,
  );
  expect(screen.getAllByRole('img', { name: /info-circle/i })).toHaveLength(1);
});
