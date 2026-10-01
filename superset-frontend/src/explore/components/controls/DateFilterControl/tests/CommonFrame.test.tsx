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
import { DateFilterTestKey } from '../utils';
import { CommonFrame } from '../components';

test('renders the title and one radio per common range', () => {
  render(<CommonFrame onChange={jest.fn()} value="Last month" />);

  expect(screen.getByTestId(DateFilterTestKey.CommonFrame)).toHaveTextContent(
    'Configure Time Range: Last...',
  );
  const radios = screen.getAllByRole('radio');
  const expectedNames = [
    'Last day',
    'Last week',
    'Last month',
    'Last quarter',
    'Last year',
  ];
  expect(radios).toHaveLength(expectedNames.length);
  expectedNames.forEach((name, index) => {
    expect(radios[index]).toHaveAccessibleName(name);
  });
});

test('checks the radio matching the value', () => {
  render(<CommonFrame onChange={jest.fn()} value="Last quarter" />);

  expect(screen.getByLabelText('Last quarter')).toBeChecked();
  expect(screen.getByLabelText('Last week')).not.toBeChecked();
});

test('does not call onChange when the value is a common range', () => {
  const onChange = jest.fn();
  render(<CommonFrame onChange={onChange} value="Last year" />);

  expect(onChange).not.toHaveBeenCalled();
});

test('falls back to Last week when the value is not a common range', () => {
  const onChange = jest.fn();
  render(<CommonFrame onChange={onChange} value="previous calendar week" />);

  expect(onChange).toHaveBeenCalledWith('Last week');
  expect(screen.getByLabelText('Last week')).toBeChecked();
});

test('calls onChange with the selected range', async () => {
  const onChange = jest.fn();
  render(<CommonFrame onChange={onChange} value="Last week" />);

  await userEvent.click(screen.getByLabelText('Last day'));

  expect(onChange).toHaveBeenCalledWith('Last day');
});
