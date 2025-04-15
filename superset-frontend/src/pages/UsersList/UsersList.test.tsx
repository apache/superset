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
import configureStore from 'redux-mock-store';
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
import UsersList from './index';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const rolesEndpoint = 'glob:*/security/roles/?*';
const usersEndpoint = 'glob:*/security/users/?*';

const mockRoles = [...new Array(3)].map((_, i) => ({
  id: i,
  name: `role ${i}`,
  user_ids: [i, i + 1],
  permission_ids: [i, i + 1, i + 2],
}));

const mockUsers = [...new Array(5)].map((_, i) => ({
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

jest.mock('src/dashboard/util/permissionUtils', () => ({
  ...jest.requireActual('src/dashboard/util/permissionUtils'),
  isUserAdmin: jest.fn(() => true),
}));

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

describe('UsersList', () => {
  async function renderAndWait() {
    const mounted = act(async () => {
      const mockedProps = {};
      render(
        <MemoryRouter>
          <QueryParamProvider>
            <UsersList user={mockUser} {...mockedProps} />
          </QueryParamProvider>
        </MemoryRouter>,
        { useRedux: true, store },
      );
    });
    return mounted;
  }
  beforeEach(() => {
    fetchMock.resetHistory();
  });

  it('renders', async () => {
    await renderAndWait();
    expect(await screen.findByText('List Users')).toBeInTheDocument();
  });

  it('fetches users on load', async () => {
    await renderAndWait();
    await waitFor(() => {
      const calls = fetchMock.calls(usersEndpoint);
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  it('fetches roles on load', async () => {
    await renderAndWait();
    await waitFor(() => {
      const calls = fetchMock.calls(rolesEndpoint);
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  it('renders filters options', async () => {
    await renderAndWait();

    const submenu = screen.queryAllByTestId('filters-select')[0];
    expect(within(submenu).getByText(/first name/i)).toBeInTheDocument();
    expect(within(submenu).getByText(/last name/i)).toBeInTheDocument();
    expect(within(submenu).getByText(/email/i)).toBeInTheDocument();
    expect(within(submenu).getByText(/username/i)).toBeInTheDocument();
    expect(within(submenu).getByText(/roles/i)).toBeInTheDocument();
    expect(within(submenu).getByText(/is active?/i)).toBeInTheDocument();
    expect(within(submenu).getByText(/created on/i)).toBeInTheDocument();
    expect(within(submenu).getByText(/changed on/i)).toBeInTheDocument();
    expect(within(submenu).getByText(/last login/i)).toBeInTheDocument();
  });

  it('renders correct list columns', async () => {
    await renderAndWait();

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    const fnameColumn = await within(table).findByText('First name');
    const lnameColumn = await within(table).findByText('Last name');
    const usernameColumn = await within(table).findByText('Username');
    const emailColumn = await within(table).findByText('Email');
    const rolesColumn = await within(table).findByText('Roles');
    const actionsColumn = await within(table).findByText('Actions');
    const activeColumn = await within(table).findByText('Is active?');

    expect(fnameColumn).toBeInTheDocument();
    expect(lnameColumn).toBeInTheDocument();
    expect(usernameColumn).toBeInTheDocument();
    expect(emailColumn).toBeInTheDocument();
    expect(rolesColumn).toBeInTheDocument();
    expect(activeColumn).toBeInTheDocument();
    expect(actionsColumn).toBeInTheDocument();
  });

  it('opens add modal when Add User button is clicked', async () => {
    await renderAndWait();

    const addButton = screen.getByTestId('add-user-button');
    fireEvent.click(addButton);

    expect(screen.queryByTestId('Add User-modal')).toBeInTheDocument();
  });

  it('open edit modal when edit button is clicked', async () => {
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
});
