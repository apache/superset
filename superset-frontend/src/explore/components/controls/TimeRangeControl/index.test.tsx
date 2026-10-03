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
import TimeRangeControl from '.';

test('renders the label and both time inputs', () => {
  render(<TimeRangeControl name="range" label="Hours" onChange={jest.fn()} />);
  expect(screen.getByText('Hours')).toBeInTheDocument();
  expect(screen.getAllByRole('textbox')).toHaveLength(2);
});

test('displays the provided start and end times', () => {
  render(
    <TimeRangeControl
      name="range"
      value={['10:15:30', '12:45:00']}
      onChange={jest.fn()}
    />,
  );
  const [start, end] = screen.getAllByRole('textbox');
  expect(start).toHaveValue('10:15:30');
  expect(end).toHaveValue('12:45:00');
});

test('leaves the inputs empty without a value', () => {
  render(<TimeRangeControl name="range" onChange={jest.fn()} />);
  screen
    .getAllByRole('textbox')
    .forEach(input => expect(input).toHaveValue(''));
});

test('calls onChange with string times when both ends are entered', async () => {
  const onChange = jest.fn();
  render(<TimeRangeControl name="range" onChange={onChange} />);
  const [start, end] = screen.getAllByRole('textbox');
  await userEvent.type(start, '08:00:00{enter}');
  await userEvent.type(end, '09:30:00{enter}');
  expect(onChange).toHaveBeenLastCalledWith(['08:00:00', '09:30:00'], null);
});
