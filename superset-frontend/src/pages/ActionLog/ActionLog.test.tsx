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
  within,
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

test('JSON column opens a tree modal for object payloads', async () => {
  fetchMock.removeRoutes();
  fetchMock.get('glob:*/api/v1/log/_info*', { permissions: ['can_read'] });
  fetchMock.get(logEndpoint, {
    result: [{ ...mockLogs[0], json: '{"path":"/superset/welcome/","n":1}' }],
    count: 1,
  });
  renderActionLog();

  await userEvent.click(
    await screen.findByText('{"path":"/superset/welcome/","n":1}'),
  );

  // A raw string handed to the tree would render as one leaf, so check that
  // each key and value gets its own node
  const dialog = within(await screen.findByRole('dialog'));
  expect(dialog.getByText('path:')).toBeInTheDocument();
  expect(dialog.getByText('"/superset/welcome/"')).toBeInTheDocument();
  expect(dialog.getByText('n:')).toBeInTheDocument();
  expect(dialog.getByText('1')).toBeInTheDocument();
});

test('JSON tree keeps quotes on numeric strings', async () => {
  fetchMock.removeRoutes();
  fetchMock.get('glob:*/api/v1/log/_info*', { permissions: ['can_read'] });
  fetchMock.get(logEndpoint, {
    result: [{ ...mockLogs[0], json: '{"dashboard_id":"123","count":123}' }],
    count: 1,
  });
  renderActionLog();

  await userEvent.click(
    await screen.findByText('{"dashboard_id":"123","count":123}'),
  );

  const dialog = within(await screen.findByRole('dialog'));
  expect(dialog.getByText('"123"')).toBeInTheDocument();
  expect(dialog.getByText('123')).toBeInTheDocument();
});

test('JSON trigger styling does not depend on data-test attributes', async () => {
  fetchMock.removeRoutes();
  fetchMock.get('glob:*/api/v1/log/_info*', { permissions: ['can_read'] });
  fetchMock.get(logEndpoint, {
    result: [{ ...mockLogs[0], json: '{"path":"/superset/welcome/"}' }],
    count: 1,
  });
  renderActionLog();

  const trigger = (
    await screen.findByText('{"path":"/superset/welcome/"}')
  ).closest('[role="button"]') as HTMLElement;
  // Production builds strip data-test, so the ellipsis must survive without it
  trigger.removeAttribute('data-test');

  expect(trigger).toHaveStyle({
    'white-space': 'nowrap',
    'text-overflow': 'ellipsis',
  });
});

test('JSON column keeps plain text for non-JSON payloads', async () => {
  fetchMock.removeRoutes();
  fetchMock.get('glob:*/api/v1/log/_info*', { permissions: ['can_read'] });
  fetchMock.get(logEndpoint, {
    result: [{ ...mockLogs[0], json: 'not json' }],
    count: 1,
  });
  renderActionLog();

  await userEvent.click(await screen.findByText('not json'));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
