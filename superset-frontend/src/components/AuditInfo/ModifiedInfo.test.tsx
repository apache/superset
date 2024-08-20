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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

import { ModifiedInfo } from '.';

const TEST_DATE = '2023-11-20';
const USER = {
  id: 1,
  first_name: 'Foo',
  last_name: 'Bar',
};

test('should render a tooltip when user is provided', async () => {
  render(<ModifiedInfo user={USER} date={TEST_DATE} />);

  const dateElement = screen.getByTestId('audit-info-date');
  expect(dateElement).toBeInTheDocument();
  expect(screen.getByText(TEST_DATE)).toBeInTheDocument();
  expect(screen.queryByText('Modified by: Foo Bar')).not.toBeInTheDocument();
  userEvent.hover(dateElement);
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();
  expect(screen.getByText('Modified by: Foo Bar')).toBeInTheDocument();
});

test('should render only the date if username is not provided', async () => {
  render(<ModifiedInfo date={TEST_DATE} />);

  const dateElement = screen.getByTestId('audit-info-date');
  expect(dateElement).toBeInTheDocument();
  expect(screen.getByText(TEST_DATE)).toBeInTheDocument();
  userEvent.hover(dateElement);
  await waitFor(
    () => {
      const tooltip = screen.queryByRole('tooltip');
      expect(tooltip).not.toBeInTheDocument();
    },
    { timeout: 1000 },
  );
});
