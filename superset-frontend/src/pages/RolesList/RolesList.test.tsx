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
import RolesList from './index';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const rolesEndpoint = 'glob:*/security/roles/search/?*';
const roleEndpoint = 'glob:*/api/v1/security/roles/*';
const permissionsEndpoint = 'glob:*/api/v1/security/permissions-resources/?*';
const usersEndpoint = 'glob:*/api/v1/security/users/?*';

const mockRoles = [...new Array(3)].map((_, i) => ({
  id: i,
  name: `role ${i}`,
  user_ids: [i, i + 1],
  permission_ids: [i, i + 1, i + 2],
}));

const mockPermissions = [...new Array(10)].map((_, i) => ({
  id: i,
  permission: { name: `permission_${i}` },
  view_menu: { name: `view_menu_${i}` },
}));

const mockUsers = [...new Array(5)].map((_, i) => ({
  id: i,
  username: `user_${i}`,
  first_name: `User`,
  last_name: `${i}`,
  roles: [
    {
      id: 1,
    },
  ],
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

jest.mock('src/dashboard/util/permissionUtils', () => ({
  ...jest.requireActual('src/dashboard/util/permissionUtils'),
  isUserAdmin: jest.fn(() => true),
}));

fetchMock.get(rolesEndpoint, {
  ids: [2, 0, 1],
  result: mockRoles,
  count: 3,
});

fetchMock.get(permissionsEndpoint, {
  count: mockPermissions.length,
  result: mockPermissions,
});

fetchMock.get(usersEndpoint, {
  count: mockUsers.length,
  result: mockUsers,
});

fetchMock.delete(roleEndpoint, {});
fetchMock.put(roleEndpoint, {});

describe('RolesList', () => {
  async function renderAndWait() {
    const mounted = act(async () => {
      const mockedProps = {};
      render(
        <MemoryRouter>
          <QueryParamProvider>
            <RolesList
              user={mockUser}
              addDangerToast={() => {}}
              addSuccessToast={() => {}}
              {...mockedProps}
            />
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
    expect(await screen.findByText('List Roles')).toBeInTheDocument();
  });

  it('fetches roles on load', async () => {
    await renderAndWait();
    await waitFor(() => {
      const calls = fetchMock.calls(rolesEndpoint);
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  it('fetches permissions on load', async () => {
    await renderAndWait();
    await waitFor(() => {
      const permissionCalls = fetchMock.calls(permissionsEndpoint);
      expect(permissionCalls.length).toBeGreaterThan(0);
    });
  });

  it('renders filters options', async () => {
    await renderAndWait();

    const typeFilter = screen.queryAllByTestId('filters-select');
    expect(typeFilter).toHaveLength(4);
  });

  it('renders correct list columns', async () => {
    await renderAndWait();

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    const nameColumn = await within(table).findByText('Name');
    const actionsColumn = await within(table).findByText('Actions');

    expect(nameColumn).toBeInTheDocument();
    expect(actionsColumn).toBeInTheDocument();
  });

  it('opens add modal when Add Role button is clicked', async () => {
    await renderAndWait();

    const addButton = screen.getByTestId('add-role-button');
    fireEvent.click(addButton);

    expect(screen.queryByTestId('Add Role-modal')).toBeInTheDocument();
  });

  it('open duplicate modal when duplicate button is clicked', async () => {
    await renderAndWait();

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    const duplicateAction = within(table).queryAllByTestId(
      'role-list-duplicate-action',
    )[0];
    expect(duplicateAction).toBeInTheDocument();
    fireEvent.click(duplicateAction);
    expect(
      screen.queryByTestId('Duplicate role role 0-modal'),
    ).toBeInTheDocument();
  });

  it('open edit modal when edit button is clicked', async () => {
    await renderAndWait();

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    const editAction = within(table).queryAllByTestId(
      'role-list-edit-action',
    )[0];
    expect(editAction).toBeInTheDocument();
    fireEvent.click(editAction);
    expect(screen.queryByTestId('Edit Role-modal')).toBeInTheDocument();
  });
});
