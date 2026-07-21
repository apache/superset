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
import { act, ComponentProps } from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { SavedQueries } from './SavedQueries';

const savedQueriesEndpoint = 'glob:*/api/v1/saved_query/?*';
const savedQueriesInfoEndpoint = 'glob:*/api/v1/saved_query/_info*';

const mockQueries = Array.from({ length: 3 }).map((_, i) => ({
  id: i,
  label: `cool query ${i}`,
  sql: 'SELECT 1',
  changed_on_delta_humanized: '1 day ago',
}));

const mockedProps: ComponentProps<typeof SavedQueries> = {
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
  user: {
    userId: 2,
    firstName: 'Test',
    lastName: 'User',
    username: 'test',
    isActive: true,
    isAnonymous: false,
  },
  queryFilter: 'Mine',
  mine: mockQueries,
  showThumbnails: false,
  featureFlag: false,
};

const renderSavedQueries = (props: ComponentProps<typeof SavedQueries>) =>
  act(async () => {
    render(<SavedQueries {...props} />, { useRedux: true, useRouter: true });
  });

beforeEach(() => {
  window.history.pushState({}, '', '/');
  fetchMock.get(
    savedQueriesEndpoint,
    { result: mockQueries },
    { name: savedQueriesEndpoint },
  );
  fetchMock.get(savedQueriesInfoEndpoint, {
    permissions: ['can_read', 'can_write'],
  });
});

afterEach(() => fetchMock.clearHistory().removeRoutes());

test('navigates to SQL Lab when a saved query card is clicked', async () => {
  await renderSavedQueries(mockedProps);

  await userEvent.click(await screen.findByText('cool query 0'));

  await waitFor(() => {
    expect(window.location.pathname).toBe('/sqllab');
    expect(window.location.search).toContain('savedQueryId=0');
  });
});

test('navigates to SQL Lab when a saved query card is activated by keyboard', async () => {
  await renderSavedQueries(mockedProps);

  const card = await screen.findByRole('button', { name: 'cool query 0' });
  card.focus();
  expect(card).toHaveFocus();

  fireEvent.keyDown(card, { key: 'Enter' });

  await waitFor(() => {
    expect(window.location.pathname).toBe('/sqllab');
    expect(window.location.search).toContain('savedQueryId=0');
  });
});

test('does not navigate when a control inside the card is activated by keyboard', async () => {
  await renderSavedQueries(mockedProps);

  const [menuButton] = await screen.findAllByRole('button', {
    name: 'More Options',
  });
  fireEvent.keyDown(menuButton, { key: 'Enter' });

  expect(window.location.pathname).toBe('/');
});

test('navigates only via the card wrapper, without a competing link', async () => {
  // With thumbnails on and a query that has no SQL, ListViewCard would render
  // its fallback cover. Navigation must come solely from the card wrapper, so
  // the card must not also render an anchor to the saved query (which would
  // double-navigate and break modified-click behavior).
  const emptySqlQuery = {
    id: 5,
    label: 'no sql query',
    changed_on_delta_humanized: '1 day ago',
  };
  fetchMock.removeRoutes();
  fetchMock.get(
    savedQueriesEndpoint,
    { result: [emptySqlQuery] },
    { name: savedQueriesEndpoint },
  );
  fetchMock.get(savedQueriesInfoEndpoint, {
    permissions: ['can_read', 'can_write'],
  });

  await renderSavedQueries({
    ...mockedProps,
    showThumbnails: true,
    mine: [emptySqlQuery],
  });

  await screen.findByText('no sql query');
  expect(document.querySelectorAll('a[href*="savedQueryId"]')).toHaveLength(0);
});
