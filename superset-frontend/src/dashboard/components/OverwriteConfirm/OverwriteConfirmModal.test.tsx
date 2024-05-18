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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';

import { fireEvent, render, waitFor } from 'spec/helpers/testing-library';
import { overwriteConfirmMetadata } from 'spec/fixtures/mockDashboardState';
import OverwriteConfirmModal from './OverwriteConfirmModal';

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

jest.mock('react-diff-viewer-continued', () => () => (
  <div data-test="mock-diff-viewer" />
));

test('renders diff viewer when it contains overwriteConfirmMetadata', async () => {
  const { queryByText, findAllByTestId } = render(
    <OverwriteConfirmModal
      overwriteConfirmMetadata={overwriteConfirmMetadata}
    />,
    {
      useRedux: true,
      store: mockStore(),
    },
  );
  expect(queryByText('Confirm overwrite')).toBeInTheDocument();
  const diffViewers = await findAllByTestId('mock-diff-viewer');
  expect(diffViewers).toHaveLength(
    overwriteConfirmMetadata.overwriteConfirmItems.length,
  );
});

test('requests update dashboard api when save button is clicked', async () => {
  const updateDashboardEndpoint = `glob:*/api/v1/dashboard/${overwriteConfirmMetadata.dashboardId}`;
  fetchMock.put(updateDashboardEndpoint, {
    id: overwriteConfirmMetadata.dashboardId,
    last_modified_time: +new Date(),
    result: overwriteConfirmMetadata.data,
  });
  const store = mockStore({
    dashboardLayout: {},
    dashboardFilters: {},
  });
  const { findByTestId } = render(
    <OverwriteConfirmModal
      overwriteConfirmMetadata={overwriteConfirmMetadata}
    />,
    {
      useRedux: true,
      store,
    },
  );
  const saveButton = await findByTestId('overwrite-confirm-save-button');
  expect(fetchMock.calls(updateDashboardEndpoint)).toHaveLength(0);
  fireEvent.click(saveButton);
  expect(fetchMock.calls(updateDashboardEndpoint)).toHaveLength(0);
  mockAllIsIntersecting(true);
  fireEvent.click(saveButton);
  await waitFor(() =>
    expect(fetchMock.calls(updateDashboardEndpoint)?.[0]?.[1]?.body).toEqual(
      JSON.stringify(overwriteConfirmMetadata.data),
    ),
  );
  await waitFor(() =>
    expect(store.getActions()).toContainEqual({
      type: 'SET_OVERRIDE_CONFIRM',
      overwriteConfirmMetadata: undefined,
    }),
  );
});
