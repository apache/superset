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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import Alert, { AlertProps } from 'src/components/Alert';

type AlertType = Pick<AlertProps, 'type'>;
type AlertTypeValue = AlertType[keyof AlertType];

test('renders with default props', async () => {
  render(<Alert message="Message" />);

  expect(screen.getByRole('alert')).toHaveTextContent('Message');
  expect(await screen.findByLabelText(`info icon`)).toBeInTheDocument();
  expect(await screen.findByLabelText('close icon')).toBeInTheDocument();
});

test('renders each type', async () => {
  const types: AlertTypeValue[] = ['info', 'error', 'warning', 'success'];
  for (let i = 0; i < types.length; i += 1) {
    const type = types[i];
    render(<Alert type={type} message="Message" />);
    // eslint-disable-next-line no-await-in-loop
    expect(await screen.findByLabelText(`${type} icon`)).toBeInTheDocument();
  }
});

test('renders without close button', async () => {
  render(<Alert message="Message" closable={false} />);

  await waitFor(() => {
    expect(screen.queryByLabelText('close icon')).not.toBeInTheDocument();
  });
});

test('disappear when closed', () => {
  render(<Alert message="Message" />);
  userEvent.click(screen.queryByLabelText('close icon')!);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('renders without icon', async () => {
  const type = 'info';
  render(<Alert type={type} message="Message" showIcon={false} />);
  await waitFor(() => {
    expect(screen.queryByLabelText(`${type} icon`)).not.toBeInTheDocument();
  });
});

test('renders message', async () => {
  render(<Alert message="Message" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Message');
});

test('renders message and description', async () => {
  render(<Alert message="Message" description="Description" />);
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Message');
  expect(alert).toHaveTextContent('Description');
});
