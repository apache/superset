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
import rison from 'rison';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within } from 'spec/helpers/testing-library';
import OAuth2TokensModal from './OAuth2TokensModal';
import { ConfigurationMethod } from './types';

const database = {
  id: 1,
  uuid: '846ddf91-9cc3-4fb7-a218-e9d26ca5fe39',
  database_name: 'OAuth database',
  name: 'OAuth database',
  driver: 'trino',
  configuration_method: ConfigurationMethod.SqlalchemyUri,
  is_managed_externally: false,
};
const endpoint = `/api/v1/database/${database.id}/oauth2_tokens/`;
type ListQuery = { page_size?: number; filters?: { value: string }[] };
const decodeListQuery = (query: string) => rison.decode(query) as ListQuery;
const token = (index: number) => ({
  id: index,
  user: {
    username: `user${index}`,
    first_name: `First${index}`,
    last_name: 'Example',
    email: `user${index}@example.com`,
  },
  access_token_expiration: '2027-01-01T00:00:00',
});
const addSuccessToast = jest.fn();
const addDangerToast = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get(`glob:*${endpoint}?*`, {
    count: 50,
    result: [token(1), token(2)],
  });
  fetchMock.post(`glob:*${endpoint}delete/`, { message: 'OK' });
  fetchMock.post(`glob:*${endpoint}all/`, { message: 'OK' });
});
afterEach(() => fetchMock.clearHistory().removeRoutes());

const renderModal = () =>
  render(
    <OAuth2TokensModal
      database={database}
      onHide={jest.fn()}
      addSuccessToast={addSuccessToast}
      addDangerToast={addDangerToast}
    />,
  );
const confirmDeletion = async () => {
  const dialog = screen
    .getByText('Delete OAuth2 tokens?')
    .closest('[role=dialog]') as HTMLElement;
  const button = within(dialog).getByRole('button', {
    name: 'Delete',
  });
  expect(button).toBeDisabled();
  await userEvent.type(
    within(dialog).getByLabelText('Type "DELETE" to confirm'),
    'DELETE',
  );
  await userEvent.click(button);
};
const expectPayload = (payload: object) => {
  expect(
    fetchMock.callHistory.lastCall(`glob:*${endpoint}delete/`)?.options.body,
  ).toBe(JSON.stringify(payload));
};

test('individual deletion requires typed confirmation and sends only that credential ID', async () => {
  renderModal();
  await screen.findByText('user1');
  await userEvent.click(
    screen.getByRole('button', { name: 'Delete OAuth2 tokens for user1' }),
  );
  const confirmation = screen
    .getByText('Delete OAuth2 tokens?')
    .closest('[role=dialog]') as HTMLElement;
  expect(within(confirmation).queryByText('user1')).not.toBeInTheDocument();
  expect(
    within(confirmation).getByText(/Delete 1 stored credential pair/),
  ).toBeInTheDocument();
  await confirmDeletion();
  await waitFor(() => expect(addSuccessToast).toHaveBeenCalled());
  expectPayload({ token_ids: [token(1).id] });
});

test('bulk deletion submits selected rows on the current page', async () => {
  renderModal();
  await screen.findByText('user1');
  await userEvent.click(screen.getAllByRole('checkbox')[0]);
  expect(screen.getByText('2 Selected')).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'Delete selected' }),
  );
  await confirmDeletion();
  await waitFor(() => expect(addSuccessToast).toHaveBeenCalled());
  expectPayload({ token_ids: [token(1).id, token(2).id] });
});

test('changing pages clears selection and fetches a server-side page', async () => {
  renderModal();
  await screen.findByText('user1');
  await userEvent.click(screen.getAllByRole('checkbox')[1]);
  expect(screen.getByText('1 Selected')).toBeInTheDocument();
  await userEvent.click(screen.getByTitle('2'));
  expect(screen.getByText('0 Select')).toBeInTheDocument();
  await waitFor(() =>
    expect(
      fetchMock.callHistory
        .calls()
        .some(call =>
          new URL(call.url).searchParams.get('q')?.includes('page:1'),
        ),
    ).toBe(true),
  );
});

test('searching clears selection and delete-all remains connection-wide', async () => {
  renderModal();
  await screen.findByText('user1');
  await userEvent.click(screen.getAllByRole('checkbox')[1]);
  await userEvent.type(
    screen.getByPlaceholderText('Search by username, name, or email'),
    'First1',
  );
  expect(screen.getByText('0 Select')).toBeInTheDocument();
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls().some(call => {
        const query = new URL(call.url).searchParams.get('q');
        return (
          query &&
          decodeListQuery(query).filters?.some(
            filter => filter.value === 'First1',
          )
        );
      }),
    ).toBe(true),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Delete all tokens' }),
    ).toBeEnabled(),
  );
  const totalRequests = fetchMock.callHistory.calls().filter(call => {
    const query = new URL(call.url).searchParams.get('q');
    return query && decodeListQuery(query).page_size === 1;
  });
  expect(totalRequests).toHaveLength(1);
  await userEvent.click(
    screen.getByRole('button', { name: 'Delete all tokens' }),
  );
  expect(
    screen.getByText(/Delete all 50 stored credential pairs/),
  ).toHaveTextContent('including users outside this page and search');
  await confirmDeletion();
  await waitFor(() => expect(addSuccessToast).toHaveBeenCalled());
  expect(
    fetchMock.callHistory.lastCall(`glob:*${endpoint}all/`)?.options.body,
  ).toBeUndefined();
  expect(fetchMock.callHistory.calls(`glob:*${endpoint}delete/`)).toHaveLength(
    0,
  );
});

test('a failed delete retains selection and permits retry', async () => {
  fetchMock.removeRoutes();
  fetchMock.get(`glob:*${endpoint}?*`, {
    count: 1,

    result: [token(1)],
  });
  fetchMock.post(`glob:*${endpoint}delete/`, 500);
  renderModal();
  await screen.findByText('user1');
  await userEvent.click(screen.getAllByRole('checkbox')[1]);
  await userEvent.click(
    screen.getByRole('button', { name: 'Delete selected' }),
  );
  await confirmDeletion();
  await waitFor(() => expect(addDangerToast).toHaveBeenCalled());
  expect(screen.getByText('1 Selected')).toBeInTheDocument();
  expect(
    screen
      .getByText('Delete OAuth2 tokens?')
      .closest('[role=dialog]') as HTMLElement,
  ).toBeInTheDocument();
  expect(addSuccessToast).not.toHaveBeenCalled();
});

test('failed listing disables deletion and offers retry', async () => {
  fetchMock.removeRoutes();
  fetchMock.get(`glob:*${endpoint}?*`, 500);
  renderModal();
  await screen.findByText('Failed to load OAuth2 tokens.');
  expect(
    screen.getByRole('button', { name: 'Delete all tokens' }),
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
});
