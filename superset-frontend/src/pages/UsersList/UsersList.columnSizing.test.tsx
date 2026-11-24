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
import { render, screen } from 'spec/helpers/testing-library';
import { MemoryRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import {
  LAPTOP_CONTAINER_WIDTH,
  getColumnWidthTotal,
  getPinnedEndHeaders,
  mockListViewContainerWidth,
} from 'spec/helpers/listViewColumnWidths';
import UsersList from './index';

jest.mock('src/dashboard/util/permissionUtils', () => ({
  ...jest.requireActual('src/dashboard/util/permissionUtils'),
  isUserAdmin: jest.fn(() => true),
}));

const mockUser = {
  userId: 1,
  firstName: 'Admin',
  lastName: 'User',
  roles: [{ id: 1, name: 'Admin' }],
};

beforeEach(() => {
  fetchMock.get('glob:*/security/users/?*', {
    ids: [1],
    result: [
      {
        active: true,
        email: 'ada@example.com',
        first_name: 'Ada',
        id: 1,
        last_name: 'Lovelace',
        roles: [{ id: 1, name: 'Admin' }],
        groups: [],
        username: 'ada',
      },
    ],
    count: 1,
  });
  fetchMock.get('glob:*/security/roles/?*', { ids: [], result: [], count: 0 });
  fetchMock.get('glob:*/security/groups/*', { result: [] });
});

afterEach(() => {
  fetchMock.removeRoutes().clearHistory();
  jest.restoreAllMocks();
});

test('every column fits at a 1440px viewport', async () => {
  mockListViewContainerWidth(LAPTOP_CONTAINER_WIDTH);
  render(
    <MemoryRouter>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <UsersList user={mockUser} />
      </QueryParamProvider>
    </MemoryRouter>,
    { useRedux: true, store: configureStore([thunk])({}) },
  );
  await screen.findByText('ada@example.com');
  const table = screen.getByTestId('listview-table').querySelector('table')!;
  // The table does not scroll, so Actions is in view.
  expect(getColumnWidthTotal(table)).toBe(LAPTOP_CONTAINER_WIDTH);
  expect(getPinnedEndHeaders(table)).toEqual([]);
});
