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
import { render, screen, waitFor, within } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';

import {
  AlertReportCronScheduler,
  AlertReportCronSchedulerProps,
} from './AlertReportCronScheduler';

const createProps = (props: Partial<AlertReportCronSchedulerProps> = {}) => ({
  onChange: jest.fn(),
  value: '* * * * *',
  ...props,
});

test('should render', () => {
  const props = createProps();
  render(<AlertReportCronScheduler {...props} />);

  // Text found in the first radio option
  expect(screen.getByText('Every')).toBeInTheDocument();
  // Text found in the second radio option
  expect(screen.getByText('CRON Schedule')).toBeInTheDocument();
});

test('only one radio option should be enabled at a time', () => {
  const props = createProps();
  const { container } = render(<AlertReportCronScheduler {...props} />);

  expect(screen.getByTestId('picker')).toBeChecked();
  expect(screen.getByTestId('input')).not.toBeChecked();

  const pickerContainer = container.querySelector(
    '.react-js-cron-select',
  ) as HTMLElement;
  const inputContainer = screen.getByTestId('input-content');

  expect(within(pickerContainer).getAllByRole('combobox')[0]).toBeEnabled();
  expect(inputContainer.querySelector('input[name="crontab"]')).toBeDisabled();

  userEvent.click(screen.getByTestId('input'));

  expect(within(pickerContainer).getAllByRole('combobox')[0]).toBeDisabled();
  expect(inputContainer.querySelector('input[name="crontab"]')).toBeEnabled();

  userEvent.click(screen.getByTestId('picker'));

  expect(within(pickerContainer).getAllByRole('combobox')[0]).toBeEnabled();
  expect(inputContainer.querySelector('input[name="crontab"]')).toBeDisabled();
});

test('picker mode updates correctly', async () => {
  const onChangeCallback = jest.fn();
  const props = createProps({
    onChange: onChangeCallback,
  });

  const { container } = render(<AlertReportCronScheduler {...props} />);

  expect(screen.getByTestId('picker')).toBeChecked();

  const pickerContainer = container.querySelector(
    '.react-js-cron-select',
  ) as HTMLElement;

  const firstSelect = within(pickerContainer).getAllByRole('combobox')[0];
  act(() => {
    userEvent.click(firstSelect);
  });

  expect(await within(pickerContainer).findByText('day')).toBeInTheDocument();
  act(() => {
    userEvent.click(within(pickerContainer).getByText('day'));
  });

  expect(onChangeCallback).toHaveBeenLastCalledWith('* * * * *');

  const secondSelect = container.querySelector(
    '.react-js-cron-hours .ant-select-selector',
  ) as HTMLElement;
  await waitFor(() => {
    expect(secondSelect).toBeInTheDocument();
  });

  act(() => {
    userEvent.click(secondSelect);
  });

  expect(await screen.findByText('9')).toBeInTheDocument();
  act(() => {
    userEvent.click(screen.getByText('9'));
  });

  await waitFor(() => {
    expect(onChangeCallback).toHaveBeenLastCalledWith('* 9 * * *');
  });
});

test('input mode updates correctly', async () => {
  const onChangeCallback = jest.fn();
  const props = createProps({
    onChange: onChangeCallback,
  });

  render(<AlertReportCronScheduler {...props} />);

  const inputContainer = screen.getByTestId('input-content');
  userEvent.click(screen.getByTestId('input'));

  const input = inputContainer.querySelector(
    'input[name="crontab"]',
  ) as HTMLElement;
  await waitFor(() => {
    expect(input).toBeEnabled();
  });

  userEvent.clear(input);
  expect(input).toHaveValue('');

  const value = '* 10 2 * *';
  await act(async () => {
    await userEvent.type(input, value, { delay: 1 });
  });

  await waitFor(() => {
    expect(input).toHaveValue(value);
  });

  act(() => {
    userEvent.click(inputContainer);
  });

  expect(onChangeCallback).toHaveBeenLastCalledWith(value);
});
