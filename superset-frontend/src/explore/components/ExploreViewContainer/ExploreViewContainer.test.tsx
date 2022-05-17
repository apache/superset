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
import React from 'react';
import fetchMock from 'fetch-mock';
import { MemoryRouter, Route } from 'react-router-dom';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import ExploreViewContainer from '.';

const reduxState = {
  explore: {
    common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 60 } },
    controls: { datasource: { value: '1__table' } },
    datasource: {
      id: 1,
      type: 'table',
      columns: [{ is_dttm: false }],
      metrics: [{ id: 1, metric_name: 'count' }],
    },
    user: {
      userId: 1,
    },
    isStarred: false,
  },
  charts: {
    1: {
      id: 1,
      latestQueryFormData: {
        datasource: '1__table',
      },
    },
  },
};

const key = 'aWrs7w29sd';

jest.mock('react-resize-detector', () => ({
  __esModule: true,
  useResizeDetector: () => ({ height: 100, width: 100 }),
}));

jest.mock('lodash/debounce', () => ({
  __esModule: true,
  default: (fuc: Function) => fuc,
}));

fetchMock.post('glob:*/api/v1/explore/form_data*', { key });
fetchMock.put('glob:*/api/v1/explore/form_data*', { key });
fetchMock.get('glob:*/api/v1/explore/form_data*', {});

const renderWithRouter = (withKey?: boolean) => {
  const path = '/superset/explore/';
  const search = withKey ? `?form_data_key=${key}&dataset_id=1` : '';
  return render(
    <MemoryRouter initialEntries={[`${path}${search}`]}>
      <Route path={path}>
        <ExploreViewContainer />
      </Route>
    </MemoryRouter>,
    { useRedux: true, initialState: reduxState },
  );
};

test('generates a new form_data param when none is available', async () => {
  const replaceState = jest.spyOn(window.history, 'replaceState');
  await waitFor(() => renderWithRouter());
  expect(replaceState).toHaveBeenCalledWith(
    expect.anything(),
    undefined,
    expect.stringMatching('form_data_key'),
  );
  expect(replaceState).toHaveBeenCalledWith(
    expect.anything(),
    undefined,
    expect.stringMatching('dataset_id'),
  );
  replaceState.mockRestore();
});

test('generates a different form_data param when one is provided and is mounting', async () => {
  const replaceState = jest.spyOn(window.history, 'replaceState');
  await waitFor(() => renderWithRouter(true));
  expect(replaceState).not.toHaveBeenLastCalledWith(
    0,
    expect.anything(),
    undefined,
    expect.stringMatching(key),
  );
  expect(replaceState).toHaveBeenCalledWith(
    expect.anything(),
    undefined,
    expect.stringMatching('dataset_id'),
  );
  replaceState.mockRestore();
});

test('reuses the same form_data param when updating', async () => {
  const replaceState = jest.spyOn(window.history, 'replaceState');
  const pushState = jest.spyOn(window.history, 'pushState');
  await waitFor(() => renderWithRouter());
  expect(replaceState.mock.calls.length).toBe(1);
  userEvent.click(screen.getByText('Run'));
  await waitFor(() => expect(pushState.mock.calls.length).toBe(1));
  expect(replaceState.mock.calls[0]).toEqual(pushState.mock.calls[0]);
  replaceState.mockRestore();
  pushState.mockRestore();
});
