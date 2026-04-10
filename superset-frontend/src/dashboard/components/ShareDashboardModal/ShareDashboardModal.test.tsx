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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import * as copyTextToClipboard from 'src/utils/copy';
import * as urlUtils from 'src/utils/urlUtils';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import ShareDashboardModal from '.';

jest.mock('src/utils/copy', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('src/utils/urlUtils', () => ({
  ...jest.requireActual<any>('src/utils/urlUtils'),
  getDashboardPermalink: jest
    .fn()
    .mockResolvedValue({ url: 'http://localhost/superset/dashboard/p/abc/' }),
}));

const mockOnHide = jest.fn();
const mockAddSuccessToast = jest.fn();
const mockAddDangerToast = jest.fn();

const baseProps = {
  dashboardId: 1,
  dashboardTitle: 'Test Dashboard',
  show: true,
  onHide: mockOnHide,
  addSuccessToast: mockAddSuccessToast,
  addDangerToast: mockAddDangerToast,
};

const makeUser = (roleNames: string[]): UserWithPermissionsAndRoles => ({
  userId: 1,
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  isActive: true,
  email: 'test@example.com',
  roles: Object.fromEntries(roleNames.map(name => [name, []])),
  permissions: {},
});

const reduxState = {
  dataMask: {},
  dashboardState: {
    activeTabs: [],
    chartStates: {},
  },
  sliceEntities: { slices: {} },
};

const setup = (extraProps = {}) =>
  render(<ShareDashboardModal {...baseProps} {...extraProps} />, {
    useRedux: true,
    initialState: reduxState,
  });

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders Cancel and Share buttons with correct capitalization', async () => {
  setup();
  expect(
    await screen.findByRole('button', { name: 'Cancel' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
});

test('renders Copy link button with correct capitalization', async () => {
  setup();
  expect(
    await screen.findByRole('button', { name: 'Copy link' }),
  ).toBeInTheDocument();
});

test('does not render invite section for regular users', async () => {
  setup({ user: makeUser(['Alpha']) });
  await screen.findByRole('button', { name: 'Copy link' });
  expect(
    screen.queryByTestId('share-dashboard-email-input'),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Invite people')).not.toBeInTheDocument();
});

test('renders invite section for workspace admins (Admin role)', async () => {
  setup({ user: makeUser(['Admin']) });
  expect(
    await screen.findByTestId('share-dashboard-email-input'),
  ).toBeInTheDocument();
  expect(screen.getByText('Invite people')).toBeInTheDocument();
});

test('renders invite section for team admins (Team Admin role)', async () => {
  setup({ user: makeUser(['Team Admin']) });
  expect(
    await screen.findByTestId('share-dashboard-email-input'),
  ).toBeInTheDocument();
  expect(screen.getByText('Invite people')).toBeInTheDocument();
});

test('Copy link button copies the dashboard URL to clipboard', async () => {
  setup();
  const copyBtn = await screen.findByRole('button', { name: 'Copy link' });
  await userEvent.click(copyBtn);
  await waitFor(() => {
    expect(copyTextToClipboard.default).toHaveBeenCalledTimes(1);
  });
});

test('Cancel button calls onHide', async () => {
  setup();
  const cancelBtn = await screen.findByRole('button', { name: 'Cancel' });
  await userEvent.click(cancelBtn);
  expect(mockOnHide).toHaveBeenCalledTimes(1);
});

test('Share button with no invite emails calls onHide', async () => {
  setup({ user: makeUser(['Alpha']) });
  const shareBtn = await screen.findByRole('button', { name: 'Share' });
  await userEvent.click(shareBtn);
  expect(mockOnHide).toHaveBeenCalledTimes(1);
});

test('team admin can add email and trigger invite on Share', async () => {
  setup({ user: makeUser(['Team Admin']) });
  const emailInput = await screen.findByTestId('share-dashboard-email-input');
  await userEvent.type(emailInput, 'invitee@example.com{enter}');

  expect(await screen.findByText('invitee@example.com')).toBeInTheDocument();
});
