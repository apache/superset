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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import URI from 'urijs';
import { fireEvent, render, waitFor } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import TabbedSqlEditors from 'src/SqlLab/components/TabbedSqlEditors';
import { initialState } from 'src/SqlLab/fixtures';
import { newQueryTabName } from 'src/SqlLab/utils/newQueryTabName';
import { Store } from 'redux';
import { RootState } from 'src/views/store';
import { SET_ACTIVE_QUERY_EDITOR } from 'src/SqlLab/actions/sqlLab';

fetchMock.get('glob:*/api/v1/database/*', {});
fetchMock.get('glob:*/api/v1/saved_query/*', {});
fetchMock.get('glob:*/kv/*', {});

jest.mock('src/SqlLab/components/SqlEditor', () => () => (
  <div data-test="mock-sql-editor" />
));

const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const store = mockStore(initialState);

const setup = (overridesStore?: Store, initialState?: RootState) =>
  render(<TabbedSqlEditors />, {
    useRedux: true,
    initialState,
    ...(overridesStore && { store: overridesStore }),
  });

beforeEach(() => {
  store.clearActions();
});

describe('componentDidMount', () => {
  let uriStub = jest.spyOn(URI.prototype, 'search');
  let replaceState = jest.spyOn(window.history, 'replaceState');
  beforeEach(() => {
    replaceState = jest.spyOn(window.history, 'replaceState');
    uriStub = jest.spyOn(URI.prototype, 'search');
  });
  afterEach(() => {
    replaceState.mockReset();
    uriStub.mockReset();
  });
  test('should handle id', () => {
    uriStub.mockReturnValue({ id: 1 });
    setup(store);
    expect(replaceState).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      '/sqllab',
    );
  });
  test('should handle savedQueryId', () => {
    uriStub.mockReturnValue({ savedQueryId: 1 });
    setup(store);
    expect(replaceState).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      '/sqllab',
    );
  });
  test('should handle sql', () => {
    uriStub.mockReturnValue({ sql: 1, dbid: 1 });
    setup(store);
    expect(replaceState).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      '/sqllab',
    );
  });
  test('should handle custom url params', () => {
    uriStub.mockReturnValue({
      sql: 1,
      dbid: 1,
      custom_value: 'str',
      extra_attr1: 'true',
    });
    setup(store);
    expect(replaceState).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      '/sqllab?custom_value=str&extra_attr1=true',
    );
  });
});

test('should removeQueryEditor', async () => {
  const { getByRole, getAllByRole, queryByText } = setup(
    undefined,
    initialState,
  );
  const tabCount = getAllByRole('tab').length;
  const tabList = getByRole('tablist');
  const closeButton = tabList.getElementsByTagName('button')[0];
  expect(closeButton).toBeInTheDocument();
  if (closeButton) {
    fireEvent.click(closeButton);
  }
  await waitFor(() => expect(getAllByRole('tab').length).toEqual(tabCount - 1));
  expect(queryByText(initialState.sqlLab.queryEditors[0].name)).toBeFalsy();
});
test('should add new query editor', async () => {
  const { getAllByLabelText, getAllByRole } = setup(undefined, initialState);
  const tabCount = getAllByRole('tab').length;
  fireEvent.click(getAllByLabelText('Add tab')[0]);
  await waitFor(() => expect(getAllByRole('tab').length).toEqual(tabCount + 1));
  expect(getAllByRole('tab')[tabCount]).toHaveTextContent(
    /Untitled Query (\d+)+/,
  );
});
test('should properly increment query tab name', async () => {
  const { getAllByLabelText, getAllByRole } = setup(undefined, initialState);
  const tabCount = getAllByRole('tab').length;
  const newTitle = newQueryTabName(initialState.sqlLab.queryEditors);
  fireEvent.click(getAllByLabelText('Add tab')[0]);
  await waitFor(() => expect(getAllByRole('tab').length).toEqual(tabCount + 1));
  expect(getAllByRole('tab')[tabCount]).toHaveTextContent(newTitle);
});
test('should handle select', async () => {
  const { getAllByRole } = setup(store);
  const tabs = getAllByRole('tab');
  fireEvent.click(tabs[1]);
  await waitFor(() => expect(store.getActions()).toHaveLength(1));
  expect(store.getActions()[0]).toEqual(
    expect.objectContaining({
      type: SET_ACTIVE_QUERY_EDITOR,
      queryEditor: initialState.sqlLab.queryEditors[1],
    }),
  );
});
test('should render', () => {
  const { getAllByRole } = setup(store);
  const tabs = getAllByRole('tab');
  expect(tabs).toHaveLength(initialState.sqlLab.queryEditors.length);
});
test('should disable new tab when offline', () => {
  const { queryAllByLabelText } = setup(undefined, {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      offline: true,
    },
  });
  expect(queryAllByLabelText('Add tab').length).toEqual(0);
});
test('should have an empty state when query editors is empty', async () => {
  const { getByText, getByRole } = setup(undefined, {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      queryEditors: [],
      tabHistory: [],
    },
  });

  // Clear the new tab applied in componentDidMount and check the state of the empty tab
  const removeTabButton = getByRole('button', { name: 'remove' });
  fireEvent.click(removeTabButton);

  await waitFor(() =>
    expect(getByText('Add a new tab to create SQL Query')).toBeInTheDocument(),
  );
});
