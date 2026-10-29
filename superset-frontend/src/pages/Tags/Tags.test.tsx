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
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import TagList from 'src/pages/Tags';

const mockUser = {
  userId: 1,
  firstName: 'Test',
  lastName: 'User',
};

const mockTags = [
  {
    id: 1,
    name: 'Test Tag',
    changed_on_delta_humanized: '1 day ago',
    changed_by: { first_name: 'Test', last_name: 'User', id: 1 },
  },
];

const ENDPOINTS = {
  INFO: 'glob:*/api/v1/tag/_info*',
  TAGS: 'glob:*/api/v1/tag/?*',
  FAVORITE_STATUS: 'glob:*/api/v1/tag/favorite_status/*',
  FAVORITES: 'glob:*/api/v1/tag/1/favorites/',
  RELATED_CHANGED_BY: 'glob:*/api/v1/tag/related/changed_by*',
  CATCH_ALL: 'glob:*',
};

const setupMocks = (initialFavorite = false) => {
  fetchMock.get(ENDPOINTS.INFO, {
    permissions: ['can_read', 'can_write'],
  });
  fetchMock.get(ENDPOINTS.TAGS, {
    result: mockTags,
    count: mockTags.length,
  });
  fetchMock.get(ENDPOINTS.FAVORITE_STATUS, {
    result: [{ id: 1, value: initialFavorite }],
  });
  fetchMock.post(ENDPOINTS.FAVORITES, {});
  fetchMock.delete(ENDPOINTS.FAVORITES, {});
  fetchMock.get(ENDPOINTS.RELATED_CHANGED_BY, { result: [], count: 0 });
  fetchMock.get(ENDPOINTS.CATCH_ALL, { result: [], count: 0 });
};

const renderTagList = () => {
  const store = configureStore({
    reducer: { user: (state = mockUser) => state },
    preloadedState: { user: mockUser },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }),
  });
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <QueryParamProvider adapter={ReactRouter5Adapter}>
          <TagList user={mockUser} />
        </QueryParamProvider>
      </BrowserRouter>
    </Provider>,
  );
};

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

test('reflects the fetched favorite status on the star icon', async () => {
  setupMocks(true);
  renderTagList();

  // The star fills to reflect the favorite status loaded from the API.
  await waitFor(
    () => expect(screen.getByLabelText('starred')).toBeInTheDocument(),
    { timeout: 5000 },
  );
});

test('toggles the favorite star and updates the icon on click', async () => {
  setupMocks(false);
  renderTagList();

  // Initially unstarred per the favorite_status response.
  await waitFor(
    () => expect(screen.getByLabelText('unstarred')).toBeInTheDocument(),
    { timeout: 5000 },
  );

  fireEvent.click(screen.getByTestId('fave-unfave-icon'));

  // The POST to favorite the tag fires...
  await waitFor(() =>
    expect(fetchMock.callHistory.called(ENDPOINTS.FAVORITES)).toBe(true),
  );

  // ...and the cell re-renders with the filled star (regression guard for the
  // stale columns useMemo that omitted saveFavoriteStatus/favoriteStatus).
  await waitFor(
    () => expect(screen.getByLabelText('starred')).toBeInTheDocument(),
    { timeout: 5000 },
  );
});
