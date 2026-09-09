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
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MobileUnsupported from './index';

// Mock useHistory
const mockPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockPush,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={['/chart/list/']}>
      <MobileUnsupported />
    </MemoryRouter>,
  );

test('renders the page title', () => {
  renderComponent();
  expect(
    screen.getByText("This view isn't available on mobile"),
  ).toBeInTheDocument();
});

test('renders the description text', () => {
  renderComponent();
  expect(
    screen.getByText(
      'Some features require a larger screen. Try viewing dashboards for the best mobile experience.',
    ),
  ).toBeInTheDocument();
});

test('renders the View Dashboards button', () => {
  renderComponent();
  expect(
    screen.getByRole('button', { name: 'View Dashboards' }),
  ).toBeInTheDocument();
});

test('renders the Go to Welcome Page button', () => {
  renderComponent();
  expect(
    screen.getByRole('button', { name: 'Go to Welcome Page' }),
  ).toBeInTheDocument();
});

test('does not render a Continue anyway bypass', () => {
  renderComponent();
  expect(screen.queryByText(/Continue anyway/)).not.toBeInTheDocument();
});

test('View Dashboards button navigates to dashboard list', async () => {
  renderComponent();

  const button = screen.getByRole('button', { name: 'View Dashboards' });
  await userEvent.click(button);

  expect(mockPush).toHaveBeenCalledWith('/dashboard/list/');
});

test('Go to Welcome Page button navigates to welcome page', async () => {
  renderComponent();

  const button = screen.getByRole('button', { name: 'Go to Welcome Page' });
  await userEvent.click(button);

  expect(mockPush).toHaveBeenCalledWith('/welcome/');
});
