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
import { type ReactChild } from 'react';
import fetchMock from 'fetch-mock';
import { table, initialState } from 'src/SqlLab/fixtures';
import {
  render,
  waitFor,
  fireEvent,
  screen,
} from 'spec/helpers/testing-library';
import TablePreview from '.';

jest.mock(
  'src/components/FilterableTable',
  () =>
    ({ data }: { data: Record<string, any>[] }) => (
      <div>
        {data.map((record, i) => (
          <div key={i} data-test="mock-record-row">
            {JSON.stringify(record)}
          </div>
        ))}
      </div>
    ),
);
jest.mock(
  'react-virtualized-auto-sizer',
  () =>
    ({ children }: { children: (params: { height: number }) => ReactChild }) =>
      children({ height: 500 }),
);
jest.mock('src/components/IconTooltip', () => ({
  IconTooltip: ({
    onClick,
    tooltip,
  }: {
    onClick: () => void;
    tooltip: string;
  }) => (
    <button type="button" data-test="mock-icon-tooltip" onClick={onClick}>
      {tooltip}
    </button>
  ),
}));
const getTableMetadataEndpoint =
  /\/api\/v1\/database\/\d+\/table_metadata\/(?:\?.*)?$/;
const getExtraTableMetadataEndpoint =
  /\/api\/v1\/database\/\d+\/table_metadata\/extra\/(?:\?.*)?$/;
const fetchPreviewEndpoint = 'glob:*/api/v1/sqllab/execute/';

beforeEach(() => {
  fetchMock.get(getTableMetadataEndpoint, table);
  fetchMock.get(getExtraTableMetadataEndpoint, {});
  fetchMock.post(fetchPreviewEndpoint, `{ "data": 123 }`);
});

afterEach(() => {
  fetchMock.reset();
});

const mockedProps = {
  dbId: table.dbId,
  catalog: table.catalog,
  schema: table.schema,
  tableName: table.name,
};

test('renders columns', async () => {
  const { getAllByTestId, queryByText } = render(
    <TablePreview {...mockedProps} />,
    {
      useRedux: true,
      initialState,
    },
  );
  await waitFor(() =>
    expect(getAllByTestId('mock-record-row')).toHaveLength(
      table.columns.length,
    ),
  );
  expect(queryByText(`Columns (${table.columns.length})`)).toBeInTheDocument();
});

test('renders indexes', async () => {
  const { queryByText } = render(<TablePreview {...mockedProps} />, {
    useRedux: true,
    initialState,
  });
  await waitFor(() =>
    expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(1),
  );
  expect(queryByText(`Indexes (${table.indexes.length})`)).toBeInTheDocument();
});

test('renders preview', async () => {
  const { getByText } = render(<TablePreview {...mockedProps} />, {
    useRedux: true,
    initialState: {
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        databases: {
          [table.dbId]: {
            id: table.dbId,
            database_name: 'mysql',
            disable_data_preview: false,
          },
        },
      },
    },
  });
  await waitFor(() =>
    expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(1),
  );
  expect(fetchMock.calls(fetchPreviewEndpoint)).toHaveLength(0);
  fireEvent.click(getByText('Data preview'));
  await waitFor(() =>
    expect(fetchMock.calls(fetchPreviewEndpoint)).toHaveLength(1),
  );
});

describe('table actions', () => {
  test('refreshes table metadata when triggered', async () => {
    const { getByRole, getByText } = render(<TablePreview {...mockedProps} />, {
      useRedux: true,
      initialState,
    });
    await waitFor(() =>
      expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(1),
    );
    const menuButton = getByRole('button', { name: /Table actions/i });
    fireEvent.click(menuButton);
    fireEvent.click(getByText('Refresh table schema'));
    await waitFor(() =>
      expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(2),
    );
  });

  test('shows CREATE VIEW statement', async () => {
    const { getByRole, getByText } = render(<TablePreview {...mockedProps} />, {
      useRedux: true,
      initialState,
    });
    await waitFor(() =>
      expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(1),
    );
    const menuButton = getByRole('button', { name: /Table actions/i });
    fireEvent.click(menuButton);
    fireEvent.click(getByText('Show CREATE VIEW statement'));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'CREATE VIEW statement' }),
      ).toBeInTheDocument(),
    );
  });
});
