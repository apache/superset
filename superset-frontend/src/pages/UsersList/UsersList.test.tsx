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
import fetchMock from 'fetch-mock';
import createMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from 'spec/helpers/testing-library';
import { MemoryRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import getBootstrapData from 'src/utils/getBootstrapData';
import UsersList from './index';

const mockStore = createMockStore([thunk]);
const store = mockStore({});

const rolesEndpoint = 'glob:*/security/roles/?*';
const usersEndpoint = 'glob:*/security/users/?*';
const groupsEndpoint = 'glob:*/security/groups/*';
const adminPasswordResetEndpoint = 'glob:*/security/password_recovery/admin/*';

const mockRoles = Array.from({ length: 3 }, (_, i) => ({
  id: i,
  name: `role ${i}`,
  user_ids: [i, i + 1],
  permission_ids: [i, i + 1, i + 2],
}));

const mockUsers = Array.from({ length: 5 }, (_, i) => ({
  active: true,
  changed_by: { id: 1 },
  changed_on: new Date(2025, 2, 25, 11, 4, 32 + i).toISOString(),
  created_by: { id: 1 },
  created_on: new Date(2025, 2, 25, 11, 4, 32 + i).toISOString(),
  email: `user${i}@example.com`,
  fail_login_count: null,
  first_name: `User${i}`,
  id: i + 1,
  last_login: null,
  last_name: `Test${i}`,
  login_count: null,
  roles: [{ id: i % 3, name: `role ${i % 3}` }],
  username: `user${i}`,
}));

fetchMock.get(usersEndpoint, {
  ids: [2, 0, 1, 3, 4],
  result: mockUsers,
  count: 5,
});

fetchMock.get(rolesEndpoint, {
  ids: [2, 0, 1],
  result: mockRoles,
  count: 3,
});

fetchMock.get(groupsEndpoint, { result: [] });

const mockAdminResetResponse = (response: object) => {
  fetchMock.removeRoute('admin-password-reset');
  fetchMock.post(adminPasswordResetEndpoint, response, {
    name: 'admin-password-reset',
  });
};

mockAdminResetResponse({
  message: 'A password reset link has been sent to the user.',
});

jest.mock('src/dashboard/util/permissionUtils', () => ({
  ...jest.requireActual('src/dashboard/util/permissionUtils'),
  isUserAdmin: jest.fn(() => true),
}));

// Password recovery off by default; tests that cover the reset action
// switch it on with mockGetBootstrapData.
const mockBootstrapData = {
  common: {
    conf: {
      AUTH_TYPE: 1,
      PASSWORD_RECOVERY_ENABLED: false,
    },
    feature_flags: {},
  },
};

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  // The default is inlined: the factory runs when the module is first
  // required, which happens while this file's imports are evaluated, before
  // any const declared below is initialized.
  default: jest.fn(() => ({
    common: {
      conf: {
        AUTH_TYPE: 1,
        PASSWORD_RECOVERY_ENABLED: false,
      },
      feature_flags: {},
    },
  })),
}));

const mockGetBootstrapData = getBootstrapData as jest.Mock;

const enablePasswordRecovery = () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 1,
        PASSWORD_RECOVERY_ENABLED: true,
      },
      feature_flags: {},
    },
  });
};

const mockUser = {
  userId: 1,
  firstName: 'Admin',
  lastName: 'User',
  roles: [
    {
      id: 1,
      name: 'Admin',
    },
  ],
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('UsersList', () => {
  async function renderAndWait() {
    const mounted = act(async () => {
      const mockedProps = {};
      render(
        <MemoryRouter>
          <QueryParamProvider adapter={ReactRouter5Adapter}>
            <UsersList user={mockUser} {...mockedProps} />
          </QueryParamProvider>
        </MemoryRouter>,
        { useRedux: true, store },
      );
    });
    return mounted;
  }
  beforeEach(() => {
    fetchMock.clearHistory();
    store.clearActions();
    mockGetBootstrapData.mockReturnValue(mockBootstrapData);
    mockAdminResetResponse({
      message: 'A password reset link has been sent to the user.',
    });
  });

  test('renders', async () => {
    await renderAndWait();
    expect(await screen.findByText('List Users')).toBeInTheDocument();
  });

  test('fetches users on load', async () => {
    await renderAndWait();
    await waitFor(() => {
      const calls = fetchMock.callHistory.calls(usersEndpoint);
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  test('fetches roles on load', async () => {
    await renderAndWait();
    await waitFor(() => {
      const calls = fetchMock.callHistory.calls(rolesEndpoint);
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  test('renders filters options', async () => {
    await renderAndWait();

    // The compact filter UI shows: only the first search filter as an input,
    // and select/datetime filters as pill buttons. Only "First name" search
    // renders (subsequent search filters are hidden — one search box per page).
    expect(screen.getByTestId('filters-search')).toBeInTheDocument();

    // Select and datetime filters render as compact pill buttons
    const pills = screen.getAllByTestId('compact-filter-pill');
    const pillLabels = pills.map(p => p.textContent ?? '');
    expect(pillLabels.some(l => /roles/i.test(l))).toBe(true);
    expect(pillLabels.some(l => /is active\?/i.test(l))).toBe(true);
  });

  test('renders correct list columns', async () => {
    await renderAndWait();

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    const fnameColumn = await within(table).findByTitle('First name');
    const lnameColumn = await within(table).findByTitle('Last name');
    const usernameColumn = await within(table).findByTitle('Username');
    const emailColumn = await within(table).findByTitle('Email');
    const rolesColumn = await within(table).findByTitle('Roles');
    const actionsColumn = await within(table).findByTitle('Actions');
    const activeColumn = await within(table).findByTitle('Is active?');

    expect(fnameColumn).toBeInTheDocument();
    expect(lnameColumn).toBeInTheDocument();
    expect(usernameColumn).toBeInTheDocument();
    expect(emailColumn).toBeInTheDocument();
    expect(rolesColumn).toBeInTheDocument();
    expect(activeColumn).toBeInTheDocument();
    expect(actionsColumn).toBeInTheDocument();
  });

  test('opens add modal when Add User button is clicked', async () => {
    await renderAndWait();

    const addButton = screen.getByTestId('add-user-button');
    fireEvent.click(addButton);

    expect(screen.queryByTestId('Add User-modal')).toBeInTheDocument();
  });

  test('open edit modal when edit button is clicked', async () => {
    await renderAndWait();

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    const editAction = within(table).queryAllByTestId(
      'user-list-edit-action',
    )[0];
    expect(editAction).toBeInTheDocument();
    fireEvent.click(editAction);
    expect(screen.queryByTestId('Edit User-modal')).toBeInTheDocument();
  });

  test('hides the reset password action when recovery is disabled', async () => {
    await renderAndWait();

    const table = screen.getByRole('table');
    expect(
      within(table).queryByTestId('user-list-reset-password-action'),
    ).not.toBeInTheDocument();
  });

  test('shows the reset password action when recovery is enabled', async () => {
    enablePasswordRecovery();
    await renderAndWait();

    const table = screen.getByRole('table');
    expect(
      within(table).queryAllByTestId('user-list-reset-password-action'),
    ).toHaveLength(5);
  });

  test('sends a reset email after confirming', async () => {
    enablePasswordRecovery();
    await renderAndWait();

    const table = screen.getByRole('table');
    const [resetAction] = within(table).queryAllByTestId(
      'user-list-reset-password-action',
    );
    fireEvent.click(resetAction);

    expect(screen.getByText('Send password reset email?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }));

    await waitFor(() => {
      expect(
        fetchMock.callHistory.calls(adminPasswordResetEndpoint),
      ).toHaveLength(1);
    });
    const lastCall = fetchMock.callHistory.lastCall(adminPasswordResetEndpoint);
    const { user_id } = JSON.parse(lastCall?.options?.body as string);
    expect([1, 2, 3, 4, 5]).toContain(user_id);
    expect(store.getActions()).toContainEqual(
      expect.objectContaining({
        type: 'ADD_TOAST',
        payload: expect.objectContaining({
          text: `Password reset email sent to user${user_id - 1}@example.com`,
        }),
      }),
    );
    expect(
      screen.queryByText('Send password reset email?'),
    ).not.toBeInTheDocument();
  });

  test('sends only one reset email when the send button is clicked twice', async () => {
    enablePasswordRecovery();
    await renderAndWait();

    const table = screen.getByRole('table');
    const [resetAction] = within(table).queryAllByTestId(
      'user-list-reset-password-action',
    );
    fireEvent.click(resetAction);

    const sendButton = screen.getByRole('button', { name: 'Send email' });
    fireEvent.click(sendButton);
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(
        fetchMock.callHistory.calls(adminPasswordResetEndpoint),
      ).toHaveLength(1);
    });
  });

  test('shows an error toast when the reset request fails', async () => {
    enablePasswordRecovery();
    mockAdminResetResponse({
      status: 400,
      body: { message: 'This user account is not active.' },
    });
    await renderAndWait();

    const table = screen.getByRole('table');
    const [resetAction] = within(table).queryAllByTestId(
      'user-list-reset-password-action',
    );
    fireEvent.click(resetAction);
    fireEvent.click(screen.getByRole('button', { name: 'Send email' }));

    await waitFor(() => {
      expect(store.getActions()).toContainEqual(
        expect.objectContaining({
          type: 'ADD_TOAST',
          payload: expect.objectContaining({
            text: 'This user account is not active.',
          }),
        }),
      );
    });
  });
});
