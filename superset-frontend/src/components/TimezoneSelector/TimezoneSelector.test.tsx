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
import React from 'react';
import moment from 'moment-timezone';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import TimezoneSelector from './index';

jest.spyOn(moment.tz, 'guess').mockReturnValue('America/New_York');

const getSelectOptions = () =>
  waitFor(() => document.querySelectorAll('.ant-select-item-option-content'));

it('use the timezone from `moment` if no timezone provided', () => {
  const onTimezoneChange = jest.fn();
  render(<TimezoneSelector onTimezoneChange={onTimezoneChange} />);
  expect(onTimezoneChange).toHaveBeenCalledTimes(1);
  expect(onTimezoneChange).toHaveBeenCalledWith('America/Nassau');
});

it('update to closest deduped timezone when timezone is provided', async () => {
  const onTimezoneChange = jest.fn();
  render(
    <TimezoneSelector
      onTimezoneChange={onTimezoneChange}
      timezone="America/Los_Angeles"
    />,
  );
  expect(onTimezoneChange).toHaveBeenCalledTimes(1);
  expect(onTimezoneChange).toHaveBeenLastCalledWith('America/Vancouver');
});

it('use the default timezone when an invalid timezone is provided', async () => {
  const onTimezoneChange = jest.fn();
  render(
    <TimezoneSelector onTimezoneChange={onTimezoneChange} timezone="UTC" />,
  );
  expect(onTimezoneChange).toHaveBeenCalledTimes(1);
  expect(onTimezoneChange).toHaveBeenLastCalledWith('Africa/Abidjan');
});

it.skip('can select a timezone values and returns canonical value', async () => {
  const onTimezoneChange = jest.fn();
  render(
    <TimezoneSelector
      onTimezoneChange={onTimezoneChange}
      timezone="America/Nassau"
    />,
  );

  const searchInput = screen.getByRole('combobox', {
    name: 'Timezone selector',
  });
  expect(searchInput).toBeInTheDocument();
  userEvent.click(searchInput);
  const isDaylight = moment(moment.now()).isDST();

  const selectedTimezone = isDaylight
    ? 'GMT -04:00 (Eastern Daylight Time)'
    : 'GMT -05:00 (Eastern Standard Time)';

  // selected option ranks first
  const options = await getSelectOptions();
  expect(options[0]).toHaveTextContent(selectedTimezone);

  // others are ranked by offset
  expect(options[1]).toHaveTextContent('GMT -11:00 (Pacific/Pago_Pago)');
  expect(options[2]).toHaveTextContent('GMT -10:00 (Hawaii Standard Time)');
  expect(options[3]).toHaveTextContent('GMT -10:00 (America/Adak)');

  // search for mountain time
  await userEvent.type(searchInput, 'mou', { delay: 10 });

  const findTitle = isDaylight
    ? 'GMT -06:00 (Mountain Daylight Time)'
    : 'GMT -07:00 (Mountain Standard Time)';
  const selectOption = await screen.findByTitle(findTitle);
  expect(selectOption).toBeInTheDocument();
  userEvent.click(selectOption);
  expect(onTimezoneChange).toHaveBeenCalledTimes(1);
  expect(onTimezoneChange).toHaveBeenLastCalledWith('America/Cambridge_Bay');
});

it('can update props and rerender with different values', async () => {
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
  expect(onTimezoneChange).toHaveBeenCalledTimes(0);
});
