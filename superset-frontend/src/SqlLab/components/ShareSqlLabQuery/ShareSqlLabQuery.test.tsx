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
import { FC } from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import fetchMock from 'fetch-mock';
import { Provider } from 'react-redux';
import {
  supersetTheme,
  ThemeProvider,
  isFeatureEnabled,
} from '@superset-ui/core';
import {
  render,
  screen,
  act,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import ShareSqlLabQuery from 'src/SqlLab/components/ShareSqlLabQuery';
import { initialState } from 'src/SqlLab/fixtures';

const mockStore = configureStore([thunk]);
const defaultProps = {
  queryEditorId: 'qe1',
  addDangerToast: jest.fn(),
};
const mockQueryEditor = {
  id: defaultProps.queryEditorId,
  dbId: 0,
  name: 'query title',
  schema: 'query_schema',
  autorun: false,
  sql: 'SELECT * FROM ...',
  remoteId: 999,
};
const disabled = {
  id: 'disabledEditorId',
  remoteId: undefined,
};

const mockState = {
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    queryEditors: [mockQueryEditor, disabled],
  },
};
const store = mockStore(mockState);

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const standardProvider: FC = ({ children }) => (
  <ThemeProvider theme={supersetTheme}>
    <Provider store={store}>{children}</Provider>
  </ThemeProvider>
);

const unsavedQueryEditor = {
  id: defaultProps.queryEditorId,
  dbId: 9888,
  name: 'query title changed',
  schema: 'query_schema_updated',
  sql: 'SELECT * FROM Updated Limit 100',
  autorun: true,
  templateParams: '{ "my_value": "foo" }',
};

const standardProviderWithUnsaved: FC = ({ children }) => (
  <ThemeProvider theme={supersetTheme}>
    <Provider
      store={mockStore({
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          unsavedQueryEditor,
        },
      })}
    >
      {children}
    </Provider>
  </ThemeProvider>
);

describe('ShareSqlLabQuery', () => {
  const storeQueryUrl = 'glob:*/api/v1/sqllab/permalink';
  const storeQueryMockId = 'ci39c3';

  beforeEach(async () => {
    fetchMock.post(
      storeQueryUrl,
      () => ({ key: storeQueryMockId, url: `/p/${storeQueryMockId}` }),
      {
        overwriteRoutes: true,
      },
    );
    fetchMock.resetHistory();
    jest.clearAllMocks();
  });

  afterAll(() => fetchMock.reset());

  describe('via permalink api', () => {
    beforeAll(() => {
      mockedIsFeatureEnabled.mockImplementation(() => true);
    });

    afterAll(() => {
      mockedIsFeatureEnabled.mockReset();
    });

    it('calls storeQuery() with the query when getCopyUrl() is called', async () => {
      await act(async () => {
        render(<ShareSqlLabQuery {...defaultProps} />, {
          wrapper: standardProvider,
        });
      });
      const button = screen.getByRole('button');
      const { id: _id, remoteId: _remoteId, ...expected } = mockQueryEditor;
      userEvent.click(button);
      await waitFor(() =>
        expect(fetchMock.calls(storeQueryUrl)).toHaveLength(1),
      );
      expect(
        JSON.parse(fetchMock.calls(storeQueryUrl)[0][1]?.body as string),
      ).toEqual(expected);
    });

    it('calls storeQuery() with unsaved changes', async () => {
      await act(async () => {
        render(<ShareSqlLabQuery {...defaultProps} />, {
          wrapper: standardProviderWithUnsaved,
        });
      });
      const button = screen.getByRole('button');
      const { id: _id, ...expected } = unsavedQueryEditor;
      userEvent.click(button);
      await waitFor(() =>
        expect(fetchMock.calls(storeQueryUrl)).toHaveLength(1),
      );
      expect(
        JSON.parse(fetchMock.calls(storeQueryUrl)[0][1]?.body as string),
      ).toEqual(expected);
    });
  });
});
