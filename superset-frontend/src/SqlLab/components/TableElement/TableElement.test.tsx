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
import { isValidElement } from 'react';
import fetchMock from 'fetch-mock';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import TableElement, { Column } from 'src/SqlLab/components/TableElement';
import { table, initialState } from 'src/SqlLab/fixtures';
import { render, waitFor, fireEvent } from 'spec/helpers/testing-library';
import * as sqlLabActions from 'src/SqlLab/actions/sqlLab';
import { QueryEditor } from 'src/SqlLab/types';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

jest.mock('@superset-ui/core/components/Loading', () => ({
  Loading: () => <div data-test="mock-loading" />,
}));
jest.mock('@superset-ui/core/components/IconTooltip', () => ({
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
jest.mock(
  'src/SqlLab/components/ColumnElement',
  () =>
    ({ column }: { column: Column }) => (
      <div data-test="mock-column-element">{column.name}</div>
    ),
);
const getTableMetadataEndpoint =
  /\/api\/v1\/database\/\d+\/table_metadata\/(?:\?.*)?$/;
const getExtraTableMetadataEndpoint =
  /\/api\/v1\/database\/\d+\/table_metadata\/extra\/(?:\?.*)?$/;
const updateTableSchemaExpandedEndpoint = 'glob:*/tableschemaview/*/expanded';
const updateTableSchemaEndpoint = 'glob:*/tableschemaview/';

beforeEach(() => {
  fetchMock.get(getTableMetadataEndpoint, table);
  fetchMock.get(getExtraTableMetadataEndpoint, {});
  fetchMock.post(updateTableSchemaExpandedEndpoint, {});
  fetchMock.post(updateTableSchemaEndpoint, {});
});

afterEach(() => {
  fetchMock.reset();
});

const mockedProps = {
  table: {
    ...table,
    initialized: true,
  },
  activeKey: [table.id],
};

const createStateWithQueryEditor = (queryEditor: Partial<QueryEditor>) => ({
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    queryEditors: [queryEditor],
  },
});

const setupSyncTableTest = () => {
  const spy = jest.spyOn(sqlLabActions, 'syncTable');
  mockedIsFeatureEnabled.mockImplementation(
    featureFlag => featureFlag === FeatureFlag.SqllabBackendPersistence,
  );
  fetchMock.post(
    updateTableSchemaEndpoint,
    { id: 100 },
    { overwriteRoutes: true },
  );
  return spy;
};

test('renders', () => {
  expect(isValidElement(<TableElement table={table} />)).toBe(true);
});

test('renders with props', () => {
  expect(isValidElement(<TableElement {...mockedProps} />)).toBe(true);
});

test('has 4 IconTooltip elements', async () => {
  const { getAllByTestId } = render(<TableElement {...mockedProps} />, {
    useRedux: true,
    initialState,
  });
  await waitFor(() =>
    expect(getAllByTestId('mock-icon-tooltip')).toHaveLength(6),
  );
});

test('has 14 columns', async () => {
  const { getAllByTestId } = render(<TableElement {...mockedProps} />, {
    useRedux: true,
    initialState,
  });
  await waitFor(() =>
    expect(getAllByTestId('mock-column-element')).toHaveLength(14),
  );
});

test('fades table', async () => {
  const { getAllByTestId } = render(<TableElement {...mockedProps} />, {
    useRedux: true,
    initialState,
  });
  await waitFor(() =>
    expect(getAllByTestId('mock-icon-tooltip')).toHaveLength(6),
  );
  const style = window.getComputedStyle(getAllByTestId('fade')[0]);
  expect(style.opacity).toBe('0');
  fireEvent.mouseEnter(getAllByTestId('table-element-header-container')[0]);
  await waitFor(() =>
    expect(window.getComputedStyle(getAllByTestId('fade')[0]).opacity).toBe(
      '1',
    ),
  );
});

test('sorts columns', async () => {
  const { getAllByTestId, getByText } = render(
    <TableElement {...mockedProps} />,
    {
      useRedux: true,
      initialState,
    },
  );
  await waitFor(() =>
    expect(getAllByTestId('mock-icon-tooltip')).toHaveLength(6),
  );
  expect(
    getAllByTestId('mock-column-element').map(el => el.textContent),
  ).toEqual(table.columns.map(col => col.name));
  fireEvent.click(getByText('Sort columns alphabetically'));
  const sorted = [...table.columns.map(col => col.name)].sort();
  expect(
    getAllByTestId('mock-column-element').map(el => el.textContent),
  ).toEqual(sorted);
  expect(getAllByTestId('mock-column-element')[0]).toHaveTextContent('active');
});

test('removes the table', async () => {
  const updateTableSchemaEndpoint = 'glob:*/tableschemaview/*';
  fetchMock.delete(updateTableSchemaEndpoint, {});
  mockedIsFeatureEnabled.mockImplementation(
    featureFlag => featureFlag === FeatureFlag.SqllabBackendPersistence,
  );
  const { getAllByTestId, getByText } = render(
    <TableElement {...mockedProps} />,
    {
      useRedux: true,
      initialState,
    },
  );
  await waitFor(() =>
    expect(getAllByTestId('mock-icon-tooltip')).toHaveLength(6),
  );
  expect(fetchMock.calls(updateTableSchemaEndpoint)).toHaveLength(0);
  fireEvent.click(getByText('Remove table preview'));
  await waitFor(() =>
    expect(fetchMock.calls(updateTableSchemaEndpoint)).toHaveLength(1),
  );
  mockedIsFeatureEnabled.mockClear();
});

test('fetches table metadata when expanded', async () => {
  render(<TableElement {...mockedProps} />, {
    useRedux: true,
    initialState,
  });
  expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(0);
  expect(fetchMock.calls(getExtraTableMetadataEndpoint)).toHaveLength(0);
  await waitFor(() =>
    expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(1),
  );
  expect(fetchMock.calls(updateTableSchemaExpandedEndpoint)).toHaveLength(0);
  expect(fetchMock.calls(getExtraTableMetadataEndpoint)).toHaveLength(1);
});

test('refreshes table metadata when triggered', async () => {
  const { getAllByTestId, getByText } = render(
    <TableElement {...mockedProps} />,
    {
      useRedux: true,
      initialState,
    },
  );
  await waitFor(() =>
    expect(getAllByTestId('mock-icon-tooltip')).toHaveLength(6),
  );
  expect(fetchMock.calls(updateTableSchemaEndpoint)).toHaveLength(0);
  expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(1);

  fireEvent.click(getByText('Refresh table schema'));
  await waitFor(() =>
    expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(2),
  );
  await waitFor(() =>
    expect(fetchMock.calls(updateTableSchemaEndpoint)).toHaveLength(1),
  );
});

test('calls syncTable with valid backend ID when query editor has tabViewId', async () => {
  const syncTableSpy = setupSyncTableTest();
  const testTable = {
    ...table,
    initialized: false,
    queryEditorId: 'temp-id-123',
  };

  const state = createStateWithQueryEditor({
    id: 'temp-id-123',
    tabViewId: '42',
    inLocalStorage: false,
    name: 'Test Editor',
  });

  render(<TableElement table={testTable} activeKey={[testTable.id]} />, {
    useRedux: true,
    initialState: state,
  });

  await waitFor(() => {
    expect(syncTableSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      '42', // finalQueryEditorId
    );
  });

  syncTableSpy.mockRestore();
});

test('does not call syncTable when query editor is in localStorage', async () => {
  const syncTableSpy = setupSyncTableTest();
  const testTable = {
    ...table,
    initialized: false,
    queryEditorId: 'local-id',
  };

  const state = createStateWithQueryEditor({
    id: 'local-id',
    tabViewId: undefined,
    inLocalStorage: true,
    name: 'Local Editor',
  });

  render(<TableElement table={testTable} activeKey={[testTable.id]} />, {
    useRedux: true,
    initialState: state,
  });

  await waitFor(() => {
    expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(1);
  });

  await new Promise(resolve => setTimeout(resolve, 100));
  expect(syncTableSpy).not.toHaveBeenCalled();

  syncTableSpy.mockRestore();
});

test('does not call syncTable with non-numeric queryEditorId', async () => {
  const syncTableSpy = setupSyncTableTest();
  const testTable = {
    ...table,
    initialized: false,
    queryEditorId: 'not-a-number',
  };

  const state = createStateWithQueryEditor({
    id: 'not-a-number',
    tabViewId: 'also-not-a-number',
    inLocalStorage: false,
    name: 'Invalid Editor',
  });

  render(<TableElement table={testTable} activeKey={[testTable.id]} />, {
    useRedux: true,
    initialState: state,
  });

  await waitFor(() => {
    expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(1);
  });

  await new Promise(resolve => setTimeout(resolve, 100));
  expect(syncTableSpy).not.toHaveBeenCalled();

  syncTableSpy.mockRestore();
});

test('does not call syncTable for already initialized tables', async () => {
  const syncTableSpy = setupSyncTableTest();
  const testTable = {
    ...table,
    initialized: true, // Already initialized
    queryEditorId: '789',
  };

  const state = createStateWithQueryEditor({
    id: '789',
    tabViewId: '789',
    inLocalStorage: false,
    name: 'Initialized Editor',
  });

  render(<TableElement table={testTable} activeKey={[testTable.id]} />, {
    useRedux: true,
    initialState: state,
  });

  await waitFor(() => {
    expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(1);
  });

  await new Promise(resolve => setTimeout(resolve, 100));
  expect(syncTableSpy).not.toHaveBeenCalled();

  syncTableSpy.mockRestore();
});

test('calls syncTable after query editor is migrated from localStorage', async () => {
  const syncTableSpy = setupSyncTableTest();
  const testTable = {
    ...table,
    initialized: false,
    queryEditorId: 'temp-editor-id',
  };

  // Start with editor in localStorage
  const localState = createStateWithQueryEditor({
    id: 'temp-editor-id',
    tabViewId: undefined,
    inLocalStorage: true,
    name: 'Temp Editor',
  });

  const { rerender } = render(
    <TableElement table={testTable} activeKey={[testTable.id]} />,
    {
      useRedux: true,
      initialState: localState,
    },
  );

  await new Promise(resolve => setTimeout(resolve, 100));
  expect(syncTableSpy).not.toHaveBeenCalled();

  const migratedState = createStateWithQueryEditor({
    id: 'temp-editor-id',
    tabViewId: '999',
    inLocalStorage: false,
    name: 'Temp Editor',
  });

  rerender(<TableElement table={testTable} activeKey={[testTable.id]} />);

  const { unmount } = render(
    <TableElement table={testTable} activeKey={[testTable.id]} />,
    {
      useRedux: true,
      initialState: migratedState,
    },
  );

  await waitFor(() => {
    expect(syncTableSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      '999',
    );
  });

  unmount();
  syncTableSpy.mockRestore();
});

test('passes numeric queryEditorId validation', async () => {
  const syncTableSpy = setupSyncTableTest();
  const testTable = {
    ...table,
    initialized: false,
    queryEditorId: 'editor-123',
  };

  const state = createStateWithQueryEditor({
    id: 'editor-123',
    tabViewId: '456',
    inLocalStorage: false,
    name: 'Valid Editor',
  });

  render(<TableElement table={testTable} activeKey={[testTable.id]} />, {
    useRedux: true,
    initialState: state,
  });

  await waitFor(() => {
    expect(syncTableSpy).toHaveBeenCalled();
    const [, , finalQueryEditorId] = syncTableSpy.mock.calls[0];
    // Verify it's a valid numeric string
    expect(Number.isNaN(Number(finalQueryEditorId))).toBe(false);
    expect(typeof finalQueryEditorId).toBe('string');
    expect(finalQueryEditorId).toMatch(/^\d+$/);
  });

  syncTableSpy.mockRestore();
});
