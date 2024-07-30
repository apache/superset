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
import { fireEvent, render, waitFor } from 'spec/helpers/testing-library';
import { initialState } from 'src/SqlLab/fixtures';
import TableMetadataContent from './TableMetadataContent';

beforeEach(() => {
  fetchMock.get('glob:*/api/v1/database/*/table_metadata/extra/*', {});
  fetchMock.get('glob:*/api/v1/database/*/table_metadata/?*', {
    status: 200,
    body: {
      name: 'table1',
      selectStar: 'SELECT * FROM table1',
      columns: [
        {
          name: 'column1',
          type: 'VARCHAR',
          keys: [],
          comment: null,
        },
        {
          name: 'column2',
          type: 'VARCHAR',
          keys: [],
          comment: null,
        },
      ],
    },
  });
});

afterEach(() => {
  fetchMock.reset();
});

const mockProps = {
  dbId: 1,
  type: 'table',
  title: 'main.table1',
  schema: 'main',
  value: 'table1',
};

test('renders the table metadata from the metadata api', async () => {
  const { getByText, findByText } = render(
    <TableMetadataContent {...mockProps} />,
    {
      useRedux: true,
    },
  );
  await findByText('Columns (2)');
  expect(getByText('column1')).toBeInTheDocument();
  expect(getByText('column2')).toBeInTheDocument();
});

test('renders a error message when api fails', async () => {
  fetchMock.get(
    'glob:*/api/v1/database/*/table_metadata/?*',
    {
      status: 500,
      body: 'custom error message',
    },
    { overwriteRoutes: true },
  );
  const { findByRole } = render(<TableMetadataContent {...mockProps} />, {
    useRedux: true,
  });
  const alert = await findByRole('alert');
  expect(alert).toBeInTheDocument();
});

test('renders empty message when no columns data is returned', async () => {
  fetchMock.get(
    'glob:*/api/v1/database/*/table_metadata/?*',
    {
      status: 200,
      body: {
        name: 'table2',
        columns: [],
      },
    },
    { overwriteRoutes: true },
  );
  const { findByRole } = render(
    <TableMetadataContent {...mockProps} value="table2" />,
    {
      useRedux: true,
    },
  );
  const alert = await findByRole('alert');
  expect(alert).toHaveTextContent('Cannot find the table (table2) metadata.');
});

test('fetch data preview query on preview tab clicked', async () => {
  const previewFetchUrl = 'glob:*/api/v1/sqllab/execute/*';
  fetchMock.post(previewFetchUrl, {});
  const { findByText } = render(<TableMetadataContent {...mockProps} />, {
    useRedux: true,
    initialState: {
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        databases: {
          1: {
            id: 1,
            database_name: 'main',
            backend: 'sqlite',
          },
        },
      },
    },
  });
  const previewTab = await findByText('Preview');
  fireEvent.click(previewTab);
  await waitFor(() => expect(fetchMock.calls(previewFetchUrl)).toHaveLength(1));
});
