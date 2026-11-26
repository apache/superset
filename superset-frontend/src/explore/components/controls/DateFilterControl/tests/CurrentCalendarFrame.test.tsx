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
import { render, screen } from 'spec/helpers/testing-library';
import { CurrentCalendarFrame } from '../components/CurrentCalendarFrame';
import { CurrentDay, CurrentQuarter, CurrentWeek } from '../types';

const mockOnChange = jest.fn();

test('calls onChange(CurrentWeek) when value is invalid', () => {
  render(<CurrentCalendarFrame onChange={mockOnChange} value="InvalidValue" />);
  expect(mockOnChange).toHaveBeenCalledWith(CurrentWeek);
});

test('returns null if value is not a valid CurrentRangeType', () => {
  const { container } = render(
    <CurrentCalendarFrame onChange={mockOnChange} value="InvalidValue" />,
  );
  expect(container.childNodes.length).toBe(0);
});

test('selects the radio button matching the current value', () => {
  render(<CurrentCalendarFrame onChange={mockOnChange} value={CurrentDay} />);

  expect(screen.getByRole('radio', { name: CurrentDay })).toBeChecked();
});

test('with limits the checked option shows and stays enabled', () => {
  render(
    <CurrentCalendarFrame
      onChange={jest.fn()}
      value={CurrentQuarter}
      limits={{
        startId: 'start',
        endId: 'end',
        presets: { [CurrentQuarter]: 'too late', [CurrentWeek]: 'too late' },
      }}
    />,
  );

  const quarter = screen.getByRole('radio', { name: CurrentQuarter });
  expect(quarter).toBeChecked();
  expect(quarter).toBeEnabled();
  expect(screen.getByRole('radio', { name: CurrentWeek })).toBeDisabled();
});

test('with limits the default is the first allowed option', () => {
  const onChange = jest.fn();
  render(
    <CurrentCalendarFrame
      onChange={onChange}
      value="InvalidValue"
      limits={{
        startId: 'start',
        endId: 'end',
        presets: { [CurrentWeek]: 'too late' },
      }}
    />,
  );
  expect(onChange).toHaveBeenCalledWith(CurrentDay);
});
