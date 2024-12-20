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
import { render, waitFor } from 'spec/helpers/testing-library';
import SqlEditorLeftBar, {
  SqlEditorLeftBarProps,
} from 'src/SqlLab/components/SqlEditorLeftBar';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';
import type { RootState } from 'src/views/store';
import type { Store } from 'redux';

const mockedProps = {
  queryEditorId: defaultQueryEditor.id,
};
const mockedDatabase = {
  id: 1,
  database_name: 'main',
  backend: 'mysql',
};

jest.mock('src/SqlLab/components/TableExploreTree', () => () => null);

beforeEach(() => {
  fetchMock.get('glob:*/api/v1/database/?*', { result: [] });
  fetchMock.get('glob:*/api/v1/database/*/catalogs/?*', {
    count: 0,
    result: [],
  });
  fetchMock.get('glob:*/api/v1/database/3/schemas/?*', {
    error: 'Unauthorized',
  });
  fetchMock.get('glob:*/api/v1/database/1/schemas/?*', {
    count: 2,
    result: ['main', 'db1_schema', 'db1_schema2'],
  });
  fetchMock.get('glob:*/api/v1/database/2/schemas/?*', {
    count: 2,
    result: ['main', 'new_schema'],
  });
});

afterEach(() => {
  fetchMock.restore();
  jest.clearAllMocks();
});

const renderAndWait = (
  props: SqlEditorLeftBarProps,
  store?: Store,
  initialState?: RootState,
) =>
  waitFor(() =>
    render(<SqlEditorLeftBar {...props} />, {
      useRedux: true,
      initialState,
      ...(store && { store }),
    }),
  );

test('catalog selector should be visible when enabled in the database', async () => {
  const { getByText, getByRole } = await renderAndWait(mockedProps, undefined, {
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      databases: {
        1: {
          ...mockedDatabase,
          allow_multi_catalog: true,
        },
      },
      unsavedQueryEditor: { ...defaultQueryEditor, dbId: 1 },
    },
  });

  const dbSelect = getByRole('combobox', {
    name: 'Select database or type to search databases',
  });
  const catalogSelect = getByRole('combobox', {
    name: 'Select catalog or type to search catalogs',
  });

  expect(getByText(/Database/i)).toBeInTheDocument();
  expect(dbSelect).toBeInTheDocument();
  expect(catalogSelect).toBeInTheDocument();
});
