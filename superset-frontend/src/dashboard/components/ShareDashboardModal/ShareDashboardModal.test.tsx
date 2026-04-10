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
import { SupersetClient } from '@superset-ui/core';
import * as copyTextToClipboard from 'src/utils/copy';
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

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual<any>('@superset-ui/core'),
  SupersetClient: {
    post: jest.fn().mockResolvedValue({}),
  },
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
  expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
});

test('renders Copy link button with correct capitalization', async () => {
  setup();
  expect(
    await screen.findByRole('button', { name: 'Copy link' }),
  ).toBeInTheDocument();
});

test('Share button label is Share (not Done) when invite emails are queued', async () => {
  setup({ user: makeUser(['Admin']) });
  const emailInput = await screen.findByTestId('share-dashboard-email-input');
  await userEvent.type(emailInput, 'user@example.com{enter}');
  expect(await screen.findByRole('button', { name: 'Share' })).toBeInTheDocument();
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

test('Done button (no emails) calls onHide without posting invite', async () => {
  setup({ user: makeUser(['Alpha']) });
  const doneBtn = await screen.findByRole('button', { name: 'Done' });
  await userEvent.click(doneBtn);
  expect(mockOnHide).toHaveBeenCalledTimes(1);
  expect(SupersetClient.post).not.toHaveBeenCalled();
});

test('rejects email input without @ and shows validation error', async () => {
  setup({ user: makeUser(['Admin']) });
  const emailInput = await screen.findByTestId('share-dashboard-email-input');
  await userEvent.type(emailInput, 'notanemail{enter}');
  expect(
    await screen.findByTestId('share-dashboard-email-error'),
  ).toBeInTheDocument();
  expect(screen.queryByText('notanemail')).not.toBeInTheDocument();
});

// MINOR-2 fix: complete the team admin invite flow end-to-end
test('team admin can add email and trigger invite on Share', async () => {
  setup({ user: makeUser(['Team Admin']) });
  const emailInput = await screen.findByTestId('share-dashboard-email-input');
  await userEvent.type(emailInput, 'invitee@example.com{enter}');
  expect(await screen.findByText('invitee@example.com')).toBeInTheDocument();

  const shareBtn = await screen.findByRole('button', { name: 'Share' });
  await userEvent.click(shareBtn);

  await waitFor(() => {
    expect(SupersetClient.post).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/security/users/invite',
        jsonPayload: expect.objectContaining({
          emails: ['invitee@example.com'],
        }),
      }),
    );
  });
  expect(mockAddSuccessToast).toHaveBeenCalled();
  expect(mockOnHide).toHaveBeenCalled();
});

// MINOR-3: happy path end-to-end for workspace admin
test('workspace admin sends invite successfully', async () => {
  setup({ user: makeUser(['Admin']) });
  const emailInput = await screen.findByTestId('share-dashboard-email-input');
  await userEvent.type(emailInput, 'new.user@example.com{enter}');
  expect(await screen.findByText('new.user@example.com')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Share' }));

  await waitFor(() => {
    expect(SupersetClient.post).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/security/users/invite',
        jsonPayload: expect.objectContaining({
          emails: ['new.user@example.com'],
          dashboard_id: 1,
          dashboard_title: 'Test Dashboard',
        }),
      }),
    );
    expect(mockAddSuccessToast).toHaveBeenCalled();
    expect(mockOnHide).toHaveBeenCalled();
  });
});
