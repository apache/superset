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
import { FC } from 'react';
import { extendedDayjs } from 'src/utils/dates';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import type { TimezoneSelectorProps } from './index';

const loadComponent = (mockCurrentTime?: string) => {
  if (mockCurrentTime) {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(mockCurrentTime));
  }
  return new Promise<FC<TimezoneSelectorProps>>(resolve => {
    const { default: TimezoneSelector } = module.require('./index');
    resolve(TimezoneSelector);
  });
};

const getSelectOptions = () =>
  waitFor(() => document.querySelectorAll('.ant-select-item-option-content'));

const openSelectMenu = () => {
  const searchInput = screen.getByRole('combobox');
  userEvent.click(searchInput);
};

jest.spyOn(extendedDayjs.tz, 'guess').mockReturnValue('America/New_York');

afterEach(() => {
  jest.useRealTimers();
});

test('use the timezone from `dayjs` if no timezone provided', async () => {
  const TimezoneSelector = await loadComponent('2022-01-01');
  const onTimezoneChange = jest.fn();
  render(<TimezoneSelector onTimezoneChange={onTimezoneChange} />);
  expect(onTimezoneChange).toHaveBeenCalledTimes(1);
  expect(onTimezoneChange).toHaveBeenCalledWith('America/Detroit');
});

test('update to closest deduped timezone when timezone is provided', async () => {
  const TimezoneSelector = await loadComponent('2022-01-01');
  const onTimezoneChange = jest.fn();
  render(
    <TimezoneSelector
      onTimezoneChange={onTimezoneChange}
      timezone="America/Tijuana"
    />,
  );
  expect(onTimezoneChange).toHaveBeenCalledTimes(1);
  expect(onTimezoneChange).toHaveBeenLastCalledWith('America/Los_Angeles');
});

test('use the default timezone when an invalid timezone is provided', async () => {
  const TimezoneSelector = await loadComponent('2022-01-01');
  const onTimezoneChange = jest.fn();
  render(
    <TimezoneSelector onTimezoneChange={onTimezoneChange} timezone="UTC" />,
  );
  expect(onTimezoneChange).toHaveBeenCalledTimes(1);
  expect(onTimezoneChange).toHaveBeenLastCalledWith('Africa/Abidjan');
});

test('render timezones in correct order for standard time', async () => {
  const TimezoneSelector = await loadComponent('2022-01-01');
  const onTimezoneChange = jest.fn();
  render(
    <TimezoneSelector
      onTimezoneChange={onTimezoneChange}
      timezone="America/Nassau"
    />,
  );
  openSelectMenu();
  const options = await getSelectOptions();
  expect(options[0]).toHaveTextContent('GMT -05:00 (Eastern Standard Time)');
  expect(options[1]).toHaveTextContent('GMT -11:00 (Pacific/Midway)');
  expect(options[2]).toHaveTextContent('GMT -11:00 (Pacific/Niue)');
});

test('can select a timezone values and returns canonical timezone name', async () => {
  const TimezoneSelector = await loadComponent('2022-01-01');
  const onTimezoneChange = jest.fn();
  render(
    <TimezoneSelector
      onTimezoneChange={onTimezoneChange}
      timezone="Africa/Abidjan"
    />,
  );
  openSelectMenu();

  const searchInput = screen.getByRole('combobox');
  // search for mountain time
  userEvent.type(searchInput, 'mou');
  const findTitle = 'GMT -07:00 (Mountain Standard Time)';
  const selectOption = await screen.findByTitle(findTitle);
  userEvent.click(selectOption);
  expect(onTimezoneChange).toHaveBeenCalledTimes(1);
  expect(onTimezoneChange).toHaveBeenLastCalledWith('America/Boise');
});

test('can update props and rerender with different values', async () => {
  const TimezoneSelector = await loadComponent('2022-01-01');
  const onTimezoneChange = jest.fn();
  const { rerender } = render(
    <TimezoneSelector
      onTimezoneChange={onTimezoneChange}
      timezone="Asia/Dubai"
    />,
  );
  expect(screen.getByTitle('GMT +04:00 (Asia/Dubai)')).toBeInTheDocument();
  rerender(
    <TimezoneSelector
      onTimezoneChange={onTimezoneChange}
      timezone="Australia/Perth"
    />,
  );
  expect(screen.getByTitle('GMT +08:00 (Australia/Perth)')).toBeInTheDocument();
});
