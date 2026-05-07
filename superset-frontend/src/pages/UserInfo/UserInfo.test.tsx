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
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from 'spec/helpers/testing-library';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { MemoryRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import UserInfo from 'src/pages/UserInfo';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const meEndpoint = 'glob:*/api/v1/me/';

const mockUser: UserWithPermissionsAndRoles = {
  userId: 1,
  firstName: 'John',
  lastName: 'Doe',
  username: 'johndoe',
  email: 'john@example.com',
  isActive: true,
  loginCount: 12,
  roles: {
    Admin: [
      ['can_read', 'Dashboard'],
      ['can_write', 'Chart'],
    ],
  },
  createdOn: new Date().toISOString(),
  isAnonymous: false,
  permissions: {
    database_access: ['examples', 'birth_names'],
    datasource_access: ['examples.babynames', 'examples.world_health'],
  },
};

describe('UserInfo', () => {
  const renderPage = async () =>
    act(async () => {
      render(
        <MemoryRouter>
          <QueryParamProvider>
            <UserInfo user={mockUser} />
          </QueryParamProvider>
        </MemoryRouter>,
        { useRedux: true, store },
      );
    });

  beforeEach(() => {
    fetchMock.restore();
    fetchMock.get(meEndpoint, {
      result: {
        ...mockUser,
        first_name: 'John',
        last_name: 'Doe',
      },
    });
  });

  afterEach(() => {
    fetchMock.restore();
  });

  it('renders the user info page', async () => {
    await renderPage();

    expect(
      await screen.findByText('Your user information'),
    ).toBeInTheDocument();
    expect(screen.getByText('johndoe')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(await screen.findByText('John')).toBeInTheDocument();
    expect(screen.getByText('Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('calls the /me endpoint on mount', async () => {
    await renderPage();
    await waitFor(() => {
      expect(fetchMock.called(meEndpoint)).toBe(true);
    });
  });

  it('opens the reset password modal on button click', async () => {
    await renderPage();

    const button = await screen.findByTestId('reset-password-button');
    await act(async () => {
      fireEvent.click(button);
    });

    expect(await screen.findByText(/Reset password/i)).toBeInTheDocument();
  });

  it('opens the edit user modal on button click', async () => {
    await renderPage();

    const button = await screen.findByTestId('edit-user-button');
    await act(async () => {
      fireEvent.click(button);
    });

    const modals = await screen.findAllByText(/Edit user/i);
    expect(modals.length).toBeGreaterThan(0);
  });
});
