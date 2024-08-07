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
import {
  render,
  waitFor,
  screen,
  waitForElementToBeRemoved,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
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

test('render timezones in correct order for daylight saving time', async () => {
  const TimezoneSelector = await loadComponent('2022-07-01');
  const onTimezoneChange = jest.fn();
  render(
    <TimezoneSelector
      onTimezoneChange={onTimezoneChange}
      timezone="America/Nassau"
    />,
  );

  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  const searchInput = screen.getByRole('combobox');
  userEvent.click(searchInput);

  const options = await waitFor(() =>
    document.querySelectorAll('.ant-select-item-option-content'),
  );

  // first option is always current timezone
  expect(options[0]).toHaveTextContent('GMT -04:00 (Eastern Daylight Time)');
  expect(options[1]).toHaveTextContent('GMT -11:00 (Pacific/Pago_Pago)');
  expect(options[2]).toHaveTextContent('GMT -10:00 (Hawaii Standard Time)');
  expect(options[3]).toHaveTextContent('GMT -09:30 (Pacific/Marquesas)');
});
