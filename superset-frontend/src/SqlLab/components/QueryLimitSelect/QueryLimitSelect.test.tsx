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
import { Store } from 'redux';

import { render, screen } from 'spec/helpers/testing-library';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';
import QueryLimitSelect, {
  QueryLimitSelectProps,
  convertToNumWithSpaces,
} from 'src/SqlLab/components/QueryLimitSelect';

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

jest.mock('src/components/Select/Select', () => () => (
  <div data-test="mock-deprecated-select-select" />
));
jest.mock('src/components/Select/AsyncSelect', () => () => (
  <div data-test="mock-deprecated-async-select" />
));

const defaultQueryLimit = 100;

const setup = (props?: Partial<QueryLimitSelectProps>, store?: Store) =>
  render(
    <QueryLimitSelect
      queryEditorId={defaultQueryEditor.id}
      maxRow={100000}
      defaultQueryLimit={defaultQueryLimit}
      {...props}
    />,
    {
      useRedux: true,
      ...(store && { store }),
    },
  );

describe('QueryLimitSelect', () => {
  it('renders current query limit size', () => {
    const queryLimit = 10;
    const { getByText } = setup(
      {
        queryEditorId: defaultQueryEditor.id,
      },
      mockStore({
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          queryEditors: [
            {
              ...defaultQueryEditor,
              queryLimit,
            },
          ],
        },
      }),
    );
    expect(getByText(queryLimit)).toBeInTheDocument();
  });

  it('renders default query limit for initial queryEditor', () => {
    const { getByText } = setup({}, mockStore(initialState));
    expect(getByText(defaultQueryLimit)).toBeInTheDocument();
  });

  it('renders queryLimit from unsavedQueryEditor', () => {
    const queryLimit = 10000;
    const { getByText } = setup(
      {},
      mockStore({
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          unsavedQueryEditor: {
            id: defaultQueryEditor.id,
            queryLimit,
          },
        },
      }),
    );
    expect(getByText(convertToNumWithSpaces(queryLimit))).toBeInTheDocument();
  });

  it('renders the Select component', () => {
    setup({ maxRow: 50000 }, mockStore(initialState));

    expect(screen.getByRole('button', { name: /LIMIT:/i })).toBeInTheDocument();
    expect(screen.getByText(/100/i)).toBeInTheDocument();
  });

  it('renders dropdown select correctly when maxRow is less than 10', async () => {
    const queryLimit = 5;
    const { getByText } = setup(
      { maxRow: 5 },
      mockStore({
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          unsavedQueryEditor: {
            id: defaultQueryEditor.id,
            queryLimit,
          },
        },
      }),
    );
    expect(getByText(convertToNumWithSpaces(queryLimit))).toBeInTheDocument();
  });

  it('renders dropdown select correctly when maxRow is a multiple of 10', async () => {
    const queryLimit = 10000;
    const { getByText } = setup(
      { maxRow: 10000 },
      mockStore({
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          unsavedQueryEditor: {
            id: defaultQueryEditor.id,
            queryLimit,
          },
        },
      }),
    );
    expect(getByText(convertToNumWithSpaces(queryLimit))).toBeInTheDocument();
  });
});
