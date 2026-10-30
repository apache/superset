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
import { render, screen } from 'spec/helpers/testing-library';
import { expectTruncatingTitle } from 'spec/helpers/listViewTitleCell';
import QueryHistoryList from '.';

jest.setTimeout(30000);

const longTable = 'fct_orders_enriched_with_customer_attributes_daily_snapshot';

const mockQuery = {
  id: 1,
  changed_on: '2026-01-01T00:00:00',
  database: { database_name: 'examples' },
  schema: 'public',
  sql: 'SELECT 1',
  executed_sql: null,
  sql_tables: [
    { catalog: null, schema: 'public', table: longTable },
    { catalog: null, schema: 'public', table: 'dim_customers' },
    { catalog: null, schema: 'public', table: 'dim_dates' },
  ],
  status: 'success',
  tab_name: 'Untitled Query 1',
  user: { first_name: 'admin', id: 1, last_name: 'user', username: 'admin' },
  start_time: 1767225600000,
  start_running_time: null,
  end_time: 1767225601000,
  rows: 10,
  tmp_table_name: '',
  tracking_url: '',
};

beforeEach(() => {
  fetchMock.get('glob:*/api/v1/query/_info*', {
    permissions: ['can_read'],
  });
  fetchMock.get('glob:*/api/v1/query/?*', {
    ids: [1],
    result: [mockQuery],
    count: 1,
  });
  fetchMock.get('glob:*', { result: [], count: 0 });
});

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

test('the first table name ellipsizes while the table count stays visible', async () => {
  render(
    <MemoryRouter>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <QueryHistoryList />
      </QueryParamProvider>
    </MemoryRouter>,
    { useRedux: true },
  );
  const tableName = await screen.findByText(longTable);
  expectTruncatingTitle(tableName);
  const count = screen.getByText('(+2)');
  expect(getComputedStyle(count).flexShrink).toBe('0');
});
