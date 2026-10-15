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
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { MemoryRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import ActionLogList from 'src/pages/ActionLog';

const logEndpoint = 'glob:*/api/v1/log/?*';

const mockLogs = Array.from({ length: 3 }, (_, i) => ({
  action: `action ${i}`,
  dttm: new Date(2026, 0, i + 1).toISOString(),
  user: { username: `user${i}`, first_name: 'First', last_name: `${i}` },
}));

const renderActionLog = () =>
  render(
    <MemoryRouter>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <ActionLogList />
      </QueryParamProvider>
    </MemoryRouter>,
    { useRedux: true },
  );

const requestedUrls = () =>
  fetchMock.callHistory
    .calls(logEndpoint)
    .map(call => decodeURIComponent(call.url));

beforeEach(() => {
  fetchMock.removeRoutes().clearHistory();
  fetchMock.get(logEndpoint, { result: mockLogs, count: 60 });
  fetchMock.get('glob:*/api/v1/log/_info*', { permissions: ['can_read'] });
});

afterEach(() => {
  fetchMock.removeRoutes().clearHistory();
});

test('User column is not sortable and never sends order_column=user', async () => {
  renderActionLog();
  await screen.findByText('action 0');

  await userEvent.click(screen.getByRole('columnheader', { name: /user/i }));
  await userEvent.click(screen.getByRole('listitem', { name: '2' }));

  await waitFor(() =>
    expect(requestedUrls().some(url => url.includes('page:1'))).toBe(true),
  );
  expect(
    requestedUrls().filter(url => url.includes('order_column:user')),
  ).toHaveLength(0);
});

test('sorting by Action sends order_column=action as a positive control', async () => {
  renderActionLog();
  await screen.findByText('action 0');

  await userEvent.click(screen.getByRole('columnheader', { name: /action/i }));

  await waitFor(() =>
    expect(
      requestedUrls().some(url => url.includes('order_column:action')),
    ).toBe(true),
  );
});
