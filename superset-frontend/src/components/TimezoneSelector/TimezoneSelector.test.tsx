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
import moment from 'moment-timezone';
import userEvent from '@testing-library/user-event';
import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
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
    jest.useRealTimers();
  });
};

const getSelectOptions = () =>
  waitFor(() => document.querySelectorAll('.ant-select-item-option-content'));

const openSelectMenu = () => {
  const searchInput = screen.getByRole('combobox');
  userEvent.click(searchInput);
};

jest.spyOn(moment.tz, 'guess').mockReturnValue('America/New_York');

test('use the timezone from `moment` if no timezone provided', async () => {
  const TimezoneSelector = await loadComponent('2022-01-01');
  const onTimezoneChange = jest.fn();
  render(<TimezoneSelector onTimezoneChange={onTimezoneChange} />);
  expect(screen.getByLabelText('Loading')).toBeVisible();
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  expect(onTimezoneChange).toHaveBeenCalledTimes(1);
  expect(onTimezoneChange).toHaveBeenCalledWith('America/Nassau');
});

test('update to closest deduped timezone when timezone is provided', async () => {
  const TimezoneSelector = await loadComponent('2022-01-01');
  const onTimezoneChange = jest.fn();
  render(
    <TimezoneSelector
      onTimezoneChange={onTimezoneChange}
      timezone="America/Los_Angeles"
    />,
  );
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  expect(onTimezoneChange).toHaveBeenCalledTimes(1);
  expect(onTimezoneChange).toHaveBeenLastCalledWith('America/Vancouver');
});

test('use the default timezone when an invalid timezone is provided', async () => {
  const TimezoneSelector = await loadComponent('2022-01-01');
  const onTimezoneChange = jest.fn();
  render(
    <TimezoneSelector onTimezoneChange={onTimezoneChange} timezone="UTC" />,
  );
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
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
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  openSelectMenu();
  const options = await getSelectOptions();
  expect(options[0]).toHaveTextContent('GMT -04:00 (Eastern Daylight Time)');
  expect(options[1]).toHaveTextContent('GMT -11:00 (Pacific/Pago_Pago)');
  expect(options[2]).toHaveTextContent('GMT -10:00 (Hawaii Standard Time)');
  expect(options[3]).toHaveTextContent('GMT -09:30 (Pacific/Marquesas)');
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
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  openSelectMenu();

  const searchInput = screen.getByRole('combobox');
  // search for mountain time
  await userEvent.type(searchInput, 'mou', { delay: 10 });
  const findTitle = 'GMT -06:00 (Mountain Daylight Time)';
  const selectOption = await screen.findByTitle(findTitle);
  userEvent.click(selectOption);
  expect(onTimezoneChange).toHaveBeenCalledTimes(1);
  expect(onTimezoneChange).toHaveBeenLastCalledWith('America/Cambridge_Bay');
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
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  expect(screen.getByTitle('GMT +04:00 (Asia/Dubai)')).toBeInTheDocument();
  rerender(
    <TimezoneSelector
      onTimezoneChange={onTimezoneChange}
      timezone="Australia/Perth"
    />,
  );
  expect(screen.getByTitle('GMT +08:00 (Australia/Perth)')).toBeInTheDocument();
  expect(onTimezoneChange).toHaveBeenCalledTimes(0);
});
