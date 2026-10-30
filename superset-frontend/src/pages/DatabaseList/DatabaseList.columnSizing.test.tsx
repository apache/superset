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
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, within } from 'spec/helpers/testing-library';
import { mockListViewContainerWidth } from 'spec/helpers/listViewColumnWidths';
import DatabaseList from 'src/pages/DatabaseList';

// Each hover action icon takes 24px; the cell adds 24px of padding.
const ACTION_ICON_WIDTH = 24;
const ACTION_CELL_PADDING = 24;

const user = {
  userId: 1,
  firstName: 'Admin',
  lastName: 'User',
  roles: {
    Admin: [
      ['can_read', 'Database'],
      ['can_write', 'Database'],
      ['can_export', 'Database'],
      ['can_manage_oauth2_tokens', 'Database'],
    ],
  },
  permissions: {},
  isActive: true,
  email: 'admin@example.com',
  createdOn: '2026-01-01T00:00:00',
};

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  jest.restoreAllMocks();
});

test('the actions column fits every action of an OAuth2 database', async () => {
  mockListViewContainerWidth(1920);
  fetchMock.get('glob:*/api/v1/database/_info*', {
    permissions: ['can_read', 'can_write', 'can_export'],
  });
  fetchMock.get('glob:*/api/v1/database/related/*', { result: [], count: 0 });
  fetchMock.get('glob:*/api/v1/database/?q=*', {
    count: 1,
    result: [
      {
        id: 1,
        uuid: '846ddf91-9cc3-4fb7-a218-e9d26ca5fe39',
        source_type: 'database',
        database_name: 'OAuth database',
        backend: 'trino',
        changed_by: null,
        engine_information: { supports_oauth2: true, oauth2_enabled: true },
      },
    ],
  });
  const store = configureStore({
    reducer: {
      user: (state = user) => state,
      common: (
        state = {
          conf: { SYNC_DB_PERMISSIONS_IN_ASYNC_MODE: false },
        },
      ) => state,
    },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
  });
  render(<DatabaseList user={user} />, {
    store,
    useQueryParams: true,
    useRouter: true,
  });

  const name = await screen.findByText('OAuth database');
  const row = name.closest('tr')!;
  const actions = within(row).getAllByRole('button');
  expect(actions.map(action => action.getAttribute('aria-label'))).toEqual(
    expect.arrayContaining(['Edit', 'Export', 'Manage OAuth2 tokens']),
  );
  expect(actions).toHaveLength(5);

  const table = screen.getByTestId('listview-table').querySelector('table')!;
  const headers = Array.from(table.querySelectorAll('thead th')).map(
    th => th.textContent?.trim() ?? '',
  );
  const widths = Array.from(table.querySelectorAll('colgroup col')).map(col =>
    parseInt((col as HTMLElement).style.width, 10),
  );
  expect(widths[headers.indexOf('Actions')]).toBeGreaterThanOrEqual(
    actions.length * ACTION_ICON_WIDTH + ACTION_CELL_PADDING,
  );
});
