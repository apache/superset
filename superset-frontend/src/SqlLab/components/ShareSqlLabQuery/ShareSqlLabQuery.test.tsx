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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { Provider } from 'react-redux';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
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

const standardProvider: React.FC = ({ children }) => (
  <ThemeProvider theme={supersetTheme}>
    <Provider store={store}>{children}</Provider>
  </ThemeProvider>
);

test('button is disabled and there is a request to save the query', async () => {
  const updatedProps = {
    queryEditorId: disabled.id,
  };

  render(<ShareSqlLabQuery {...updatedProps} />, {
    wrapper: standardProvider,
  });
  const button = await screen.findByRole('button', { name: /copy link/i });
  expect(button).toBeDisabled();
});
