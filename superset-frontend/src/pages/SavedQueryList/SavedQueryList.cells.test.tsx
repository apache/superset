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
import { MemoryRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { render, screen, within } from 'spec/helpers/testing-library';
import { expectTruncatingTitle } from 'spec/helpers/listViewTitleCell';
import SavedQueryList from '.';

jest.setTimeout(30000);

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.MockedFunction<
  typeof isFeatureEnabled
>;

const mockUser = { userId: 1, firstName: 'admin', lastName: 'admin' };

const longTable = 'fct_orders_enriched_with_customer_attributes_daily_snapshot';

const mockQuery = {
  created_by: { id: 1, first_name: 'user', last_name: '1' },
  created_on: '1-2020',
  database: { database_name: 'examples', id: 1 },
  changed_on_delta_humanized: '1 day ago',
  db_id: 1,
  description: 'SQL',
  id: 1,
  label: 'query with many tables',
  schema: 'public',
  sql: 'SELECT 1',
  sql_tables: [
    { catalog: null, schema: null, table: longTable },
    { catalog: null, schema: null, table: 'dim_customers' },
    { catalog: null, schema: null, table: 'dim_dates' },
  ],
  tags: ['alpha', 'bravo', 'charlie', 'delta', 'echo'].map((name, id) => ({
    id,
    name,
    type: 1,
  })),
};

beforeEach(() => {
  mockIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.TaggingSystem,
  );
  fetchMock.get('glob:*/api/v1/saved_query/_info*', {
    permissions: ['can_write', 'can_read', 'can_export'],
  });
  fetchMock.get('glob:*/api/v1/saved_query/?*', {
    ids: [1],
    result: [mockQuery],
    count: 1,
  });
  fetchMock.get('glob:*', { result: [], count: 0 });
});

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  mockIsFeatureEnabled.mockReset();
});

const renderList = () =>
  render(
    <MemoryRouter>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <SavedQueryList user={mockUser} />
      </QueryParamProvider>
    </MemoryRouter>,
    {
      useRedux: true,
      initialState: {
        user: { ...mockUser, roles: { Admin: [['can_write', 'SavedQuery']] } },
      },
    },
  );

test('the first table name ellipsizes while the table count stays visible', async () => {
  renderList();
  const tableName = await screen.findByText(longTable);
  expectTruncatingTitle(tableName);
  const count = screen.getByText('(+2)');
  expect(getComputedStyle(count).flexShrink).toBe('0');
});

test('shows at most three tag chips', async () => {
  renderList();
  const row = (await screen.findByText('query with many tables')).closest(
    'tr',
  )!;
  const chips = within(row).getAllByTestId('tag');
  expect(chips).toHaveLength(3);
  expect(chips[2]).toHaveTextContent('+3...');
});
