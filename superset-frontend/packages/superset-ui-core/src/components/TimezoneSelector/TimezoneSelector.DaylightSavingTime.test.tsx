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
import { render, waitFor, screen, userEvent } from '@superset-ui/core/spec';
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

afterEach(() => {
  jest.useRealTimers();
});

test('render timezones in correct order for daylight saving time', async () => {
  // Set system time BEFORE loading component to ensure cache uses correct date
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2022-07-01'));

  const TimezoneSelector = await loadComponent('2022-07-01');
  const onTimezoneChange = jest.fn();
  const { container } = render(
    <TimezoneSelector
      onTimezoneChange={onTimezoneChange}
      timezone="America/Nassau"
    />,
  );

  // Trigger data loading by clicking the select
  const searchInput = screen.getByRole('combobox');
  await userEvent.click(searchInput);

  // Run timers to execute queueMicrotask/setTimeout callback
  jest.runAllTimers();

  // Wait for timezone data to load
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  // Verify the selected timezone is displayed correctly (in DST)
  const selectionItem = container.querySelector('.ant-select-selection-item');
  expect(selectionItem).toHaveTextContent('GMT -04:00 (Eastern Daylight Time)');

  // Verify options are sorted by UTC offset (lowest/most negative first)
  const options = await waitFor(() =>
    document.querySelectorAll('.ant-select-item-option-content'),
  );

  // Options should be sorted by offset: -11:00 comes before -04:00
  expect(options[0]).toHaveTextContent('GMT -11:00 (Pacific/Midway)');
  expect(options[1]).toHaveTextContent('GMT -11:00 (Pacific/Niue)');
  expect(options[2]).toHaveTextContent('GMT -11:00 (Pacific/Pago_Pago)');

  // Find the Eastern Daylight Time option
  // Virtual list only renders visible items, so we search the DOM for the option element
  // by its aria-label attribute which should be available even if not rendered
  const edtOption = await waitFor(() => {
    const option = document.querySelector(
      '[aria-label="GMT -04:00 (Eastern Daylight Time)"]',
    );
    expect(option).toBeTruthy();
    return option;
  });

  expect(edtOption).toBeInTheDocument();
});
