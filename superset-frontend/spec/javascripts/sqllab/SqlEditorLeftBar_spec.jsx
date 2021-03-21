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
import fetchMock from 'fetch-mock';
import { shallow } from 'enzyme';
import { render, screen, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import '@testing-library/jest-dom/extend-expect';
import thunk from 'redux-thunk';
import SqlEditorLeftBar from 'src/SqlLab/components/SqlEditorLeftBar';
import TableElement from 'src/SqlLab/components/TableElement';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import {
  table,
  initialState,
  databases,
  defaultQueryEditor,
  mockedActions,
} from './fixtures';

const mockedProps = {
  actions: mockedActions,
  tables: [table],
  queryEditor: defaultQueryEditor,
  database: databases,
  height: 0,
};
const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const store = mockStore(initialState);
const DATABASE_ENDPOINT = 'glob:*/api/v1/database/?*';
fetchMock.get(DATABASE_ENDPOINT, []);
describe('SqlEditorLeftBar', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<SqlEditorLeftBar {...mockedProps} />, {
      context: { store },
    });
  });

  it('is valid', () => {
    expect(React.isValidElement(<SqlEditorLeftBar {...mockedProps} />)).toBe(
      true,
    );
  });

  it('renders a TableElement', () => {
    expect(wrapper.find(TableElement)).toExist();
  });
});

describe('Left Panel Expansion', () => {
  beforeEach(async () => {
    await act(async () => {
      render(
        <ThemeProvider theme={supersetTheme}>
          <Provider store={store}>
            <SqlEditorLeftBar {...mockedProps} />
          </Provider>
        </ThemeProvider>,
      );
    });
  });

  it('table should be visible when expanded is true', async () => {
    const dbSelect = screen.getByText(/select a database/i);
    const schemaSelect = screen.getByText(/select a schema \(0\)/i);
    const dropdown = screen.getByText(/Select table/i);
    const abUser = screen.getByText(/ab_user/i);
    expect(dbSelect).toBeInTheDocument();
    expect(schemaSelect).toBeInTheDocument();
    expect(dropdown).toBeInTheDocument();
    expect(abUser).toBeInTheDocument();
  });
});
