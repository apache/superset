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
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import AlertReportModal from 'src/views/CRUD/alert/AlertReportModal';

test('allows change to None in log retention', async () => {
  render(<AlertReportModal show />, { useRedux: true });
  // open the log retention select
  userEvent.click(screen.getByText('90 days'));
  // change it to 30 days
  userEvent.click(await screen.findByText('30 days'));
  // open again
  userEvent.click(screen.getAllByText('30 days')[0]);
  // change it to None
  userEvent.click(await screen.findByText('None'));
  // get the selected item
  const selectedItem = await waitFor(() =>
    screen
      .getAllByLabelText('Log retention')[0]
      .querySelector('.ant-select-selection-item'),
  );
  // check if None is selected
  expect(selectedItem).toHaveTextContent('None');
});

test('renders the appropriate dropdown in Message Content section', async () => {
  render(<AlertReportModal show />, { useRedux: true });

  const chartRadio = screen.getByRole('radio', { name: /chart/i });

  // Dashboard is initially checked by default
  expect(
    await screen.findByRole('radio', {
      name: /dashboard/i,
    }),
  ).toBeChecked();
  expect(chartRadio).not.toBeChecked();
  // Only the dashboard dropdown should show
  expect(screen.getByRole('combobox', { name: /dashboard/i })).toBeVisible();
  expect(
    screen.queryByRole('combobox', { name: /chart/i }),
  ).not.toBeInTheDocument();

  // Click the chart radio option
  userEvent.click(chartRadio);

  expect(await screen.findByRole('radio', { name: /chart/i })).toBeChecked();
  expect(screen.getByRole('radio', { name: /dashboard/i })).not.toBeChecked();
  // Now that chart is checked, only the chart dropdown should show
  expect(screen.getByRole('combobox', { name: /chart/i })).toBeVisible();
  expect(
    screen.queryByRole('combobox', { name: /dashboard/i }),
  ).not.toBeInTheDocument();
});

test('renders the appropriate dropdown in Notification Method section', async () => {
  render(<AlertReportModal show />, { useRedux: true });

  // Notification Method Button
  const button = screen.getByTestId('notification_method');
  userEvent.click(button);
  // Delivery Select dropdown
  userEvent.click(screen.getByTestId('select-delivery-method'));
  const deliveryMethod = screen
    .getByTestId('select-delivery-method')
    .querySelector('.ant-select-selection-search-input') as HTMLInputElement;
  fireEvent.select(deliveryMethod, { target: { value: 'S3' } });
  expect(deliveryMethod).toHaveValue('S3');

  waitFor(async () => {
    // S3 Method Select dropdown
    userEvent.click(screen.getByTestId('select-s3-method'));
    const inputElement = screen
      .getByTestId('select-s3-method')
      .querySelector('.ant-select-selection-search-input') as HTMLInputElement;
    fireEvent.select(inputElement, { target: { value: 'AWS_S3_credentials' } });
    expect(inputElement).toHaveValue('AWS_S3_credentials');

    // Checking for bucket name,acess key,secret key
    waitFor(async () => {
      const bucketInput = await screen.findByTestId('test-bucket');
      const accessInput = await screen.findByTestId('test-access');
      const secretInput = await screen.findByTestId('test-secret');
      expect(bucketInput).toBeInTheDocument();
      expect(accessInput).toBeInTheDocument();
      expect(secretInput).toBeInTheDocument();

      // checking for input value
      userEvent.type(bucketInput, 'test-bucket-value');
      userEvent.type(accessInput, 'test-access-value');
      userEvent.type(secretInput, 'test-secret-value');

      expect(bucketInput).toHaveValue('test-bucket-value');
      expect(accessInput).toHaveValue('test-access-value');
      expect(secretInput).toHaveValue('test-secret-value');
    });
  });
});
