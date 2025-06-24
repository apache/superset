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
import GroupsList from './index';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const mockUser = {
  userId: 1,
  firstName: 'Admin',
  lastName: 'User',
  roles: [{ id: 1, name: 'Admin' }],
};

const rolesEndpoint = 'glob:*/security/roles/?*';
const usersEndpoint = 'glob:*/security/users/?*';

const mockRoles = Array.from({ length: 3 }, (_, i) => ({
  id: i,
  name: `role ${i}`,
}));

const mockUsers = Array.from({ length: 3 }, (_, i) => ({
  id: i,
  username: `user${i}`,
}));

fetchMock.get(usersEndpoint, {
  result: mockUsers,
  count: 3,
});

fetchMock.get(rolesEndpoint, {
  result: mockRoles,
  count: 3,
});

jest.mock('src/dashboard/util/permissionUtils', () => ({
  ...jest.requireActual('src/dashboard/util/permissionUtils'),
  isUserAdmin: jest.fn(() => true),
}));

describe('GroupsList', () => {
  const renderComponent = async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <QueryParamProvider>
            <GroupsList user={mockUser} />
          </QueryParamProvider>
        </MemoryRouter>,
        { useRedux: true, store },
      );
    });
  };

  beforeEach(() => {
    fetchMock.resetHistory();
  });

  it('renders the page', async () => {
    await renderComponent();
    expect(await screen.findByText('List Groups')).toBeInTheDocument();
  });

  it('fetches roles on load', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(fetchMock.calls(rolesEndpoint).length).toBeGreaterThan(0);
    });
  });

  it('renders add group button and triggers modal', async () => {
    await renderComponent();
    const addButton = screen.getByTestId('add-group-button');
    fireEvent.click(addButton);
    expect(await screen.findByTestId('Add Group-modal')).toBeInTheDocument();
  });

  it('renders actions column for admin', async () => {
    await renderComponent();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders the filters correctly', async () => {
    await renderComponent();
    const filtersSelect = screen.getAllByTestId('filters-select')[0];

    expect(within(filtersSelect).getByText(/name/i)).toBeInTheDocument();
    expect(within(filtersSelect).getByText(/label/i)).toBeInTheDocument();
    expect(within(filtersSelect).getByText(/description/i)).toBeInTheDocument();
    expect(within(filtersSelect).getByText(/roles/i)).toBeInTheDocument();
    expect(within(filtersSelect).getByText(/users/i)).toBeInTheDocument();
  });

  it('renders correct columns in the table', async () => {
    await renderComponent();
    const table = screen.getByRole('table');

    expect(await within(table).findByText('Name')).toBeInTheDocument();
    expect(await within(table).findByText('Label')).toBeInTheDocument();
    expect(await within(table).findByText('Roles')).toBeInTheDocument();
  });

  it('opens add group modal on button click', async () => {
    await renderComponent();
    const addButton = screen.getByTestId('add-group-button');
    fireEvent.click(addButton);

    expect(await screen.findByTestId('Add Group-modal')).toBeInTheDocument();
  });

  it('opens edit modal on edit button click', async () => {
    fetchMock.get('glob:*/security/groups/?*', {
      result: [
        {
          id: 1,
          name: 'Editors',
          label: 'editors',
          description: 'Group for editors',
          roles: mockRoles,
          users: mockUsers,
        },
      ],
      count: 1,
    });

    await renderComponent();

    const editButtons = await screen.findAllByTestId('group-list-edit-action');
    fireEvent.click(editButtons[0]);

    expect(await screen.findByTestId('Edit Group-modal')).toBeInTheDocument();
  });
});
