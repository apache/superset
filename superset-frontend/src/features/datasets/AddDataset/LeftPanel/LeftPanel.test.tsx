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
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import LeftPanel from 'src/features/datasets/AddDataset/LeftPanel';
import { exampleDataset } from 'src/features/datasets/AddDataset/DatasetPanel/fixtures';

const databasesEndpoint = 'glob:*/api/v1/database/?q*';
const schemasEndpoint = 'glob:*/api/v1/database/*/schemas*';
const tablesEndpoint = 'glob:*/api/v1/database/*/tables/?q*';

beforeEach(() => {
  fetchMock.get(databasesEndpoint, {
    count: 2,
    description_columns: {},
    ids: [1, 2],
    label_columns: {
      allow_file_upload: 'Allow Csv Upload',
      allow_ctas: 'Allow Ctas',
      allow_cvas: 'Allow Cvas',
      allow_dml: 'Allow DDL and DML',
      allow_multi_schema_metadata_fetch: 'Allow Multi Schema Metadata Fetch',
      allow_run_async: 'Allow Run Async',
      allows_cost_estimate: 'Allows Cost Estimate',
      allows_subquery: 'Allows Subquery',
      allows_virtual_table_explore: 'Allows Virtual Table Explore',
      disable_data_preview: 'Disables SQL Lab Data Preview',
      disable_drill_to_detail: 'Disable Drill To Detail',
      backend: 'Backend',
      changed_on: 'Changed On',
      changed_on_delta_humanized: 'Changed On Delta Humanized',
      'created_by.first_name': 'Created By First Name',
      'created_by.last_name': 'Created By Last Name',
      database_name: 'Database Name',
      explore_database_id: 'Explore Database Id',
      expose_in_sqllab: 'Expose In Sqllab',
      force_ctas_schema: 'Force Ctas Schema',
      id: 'Id',
    },
    list_columns: [
      'allow_file_upload',
      'allow_ctas',
      'allow_cvas',
      'allow_dml',
      'allow_multi_schema_metadata_fetch',
      'allow_run_async',
      'allows_cost_estimate',
      'allows_subquery',
      'allows_virtual_table_explore',
      'disable_data_preview',
      'disable_drill_to_detail',
      'backend',
      'changed_on',
      'changed_on_delta_humanized',
      'created_by.first_name',
      'created_by.last_name',
      'database_name',
      'explore_database_id',
      'expose_in_sqllab',
      'force_ctas_schema',
      'id',
    ],
    list_title: 'List Database',
    order_columns: [
      'allow_file_upload',
      'allow_dml',
      'allow_run_async',
      'changed_on',
      'changed_on_delta_humanized',
      'created_by.first_name',
      'database_name',
      'expose_in_sqllab',
    ],
    result: [
      {
        allow_file_upload: false,
        allow_ctas: false,
        allow_cvas: false,
        allow_dml: false,
        allow_multi_schema_metadata_fetch: false,
        allow_run_async: false,
        allows_cost_estimate: null,
        allows_subquery: true,
        allows_virtual_table_explore: true,
        disable_data_preview: false,
        disable_drill_to_detail: false,
        backend: 'postgresql',
        changed_on: '2021-03-09T19:02:07.141095',
        changed_on_delta_humanized: 'a day ago',
        created_by: null,
        database_name: 'test-postgres',
        explore_database_id: 1,
        expose_in_sqllab: true,
        force_ctas_schema: null,
        id: 1,
      },
      {
        allow_csv_upload: false,
        allow_ctas: false,
        allow_cvas: false,
        allow_dml: false,
        allow_multi_schema_metadata_fetch: false,
        allow_run_async: false,
        allows_cost_estimate: null,
        allows_subquery: true,
        allows_virtual_table_explore: true,
        disable_data_preview: false,
        disable_drill_to_detail: false,
        backend: 'mysql',
        changed_on: '2021-03-09T19:02:07.141095',
        changed_on_delta_humanized: 'a day ago',
        created_by: null,
        database_name: 'test-mysql',
        explore_database_id: 1,
        expose_in_sqllab: true,
        force_ctas_schema: null,
        id: 2,
      },
    ],
  });

  fetchMock.get(schemasEndpoint, {
    result: ['information_schema', 'public'],
  });

  fetchMock.get(tablesEndpoint, {
    count: 3,
    result: [
      { value: 'Sheet1', type: 'table', extra: null },
      { value: 'Sheet2', type: 'table', extra: null },
      { value: 'Sheet3', type: 'table', extra: null },
    ],
  });
});

afterEach(() => {
  fetchMock.reset();
});

const mockFun = jest.fn();

test('should render', async () => {
  render(<LeftPanel setDataset={mockFun} />, {
    useRedux: true,
  });
  expect(
    await screen.findByText(/Select database or type to search databases/i),
  ).toBeInTheDocument();
});

test('should render schema selector, database selector container, and selects', async () => {
  render(<LeftPanel setDataset={mockFun} />, { useRedux: true });

  expect(
    await screen.findByText(/Select database or type to search databases/i),
  ).toBeVisible();

  const databaseSelect = screen.getByRole('combobox', {
    name: 'Select database or type to search databases',
  });
  const schemaSelect = screen.getByRole('combobox', {
    name: 'Select schema or type to search schemas',
  });
  expect(databaseSelect).toBeInTheDocument();
  expect(schemaSelect).toBeInTheDocument();
});

test('does not render blank state if there is nothing selected', async () => {
  render(<LeftPanel setDataset={mockFun} />, { useRedux: true });

  expect(
    await screen.findByText(/Select database or type to search databases/i),
  ).toBeInTheDocument();
  const emptyState = screen.queryByRole('img', { name: /empty/i });
  expect(emptyState).not.toBeInTheDocument();
});

test('renders list of options when user clicks on schema', async () => {
  render(<LeftPanel setDataset={mockFun} dataset={exampleDataset[0]} />, {
    useRedux: true,
  });

  // Click 'test-postgres' database to access schemas
  const databaseSelect = screen.getByRole('combobox', {
    name: 'Select database or type to search databases',
  });
  userEvent.click(databaseSelect);
  expect(await screen.findByText('test-postgres')).toBeInTheDocument();
  userEvent.click(screen.getByText('test-postgres'));

  // Schema select will be automatically populated if there is only one schema
  const schemaSelect = screen.getByRole('combobox', {
    name: /select schema or type to search schemas/i,
  });
  await waitFor(() => {
    expect(schemaSelect).toBeEnabled();
  });
});

test('searches for a table name', async () => {
  render(<LeftPanel setDataset={mockFun} dataset={exampleDataset[0]} />, {
    useRedux: true,
  });

  // Click 'test-postgres' database to access schemas
  const databaseSelect = screen.getByRole('combobox', {
    name: /select database or type to search databases/i,
  });
  userEvent.click(databaseSelect);
  userEvent.click(await screen.findByText('test-postgres'));

  const schemaSelect = screen.getByRole('combobox', {
    name: /select schema or type to search schemas/i,
  });
  const tableSelect = screen.getByRole('combobox', {
    name: /select table or type to search tables/i,
  });

  await waitFor(() => expect(schemaSelect).toBeEnabled());

  // Click 'public' schema to access tables
  userEvent.click(schemaSelect);
  userEvent.click(screen.getAllByText('public')[1]);
  await waitFor(() => expect(fetchMock.calls(tablesEndpoint).length).toBe(1));
  userEvent.click(tableSelect);

  await waitFor(() => {
    expect(
      screen.queryByRole('option', {
        name: /Sheet1/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', {
        name: /Sheet2/i,
      }),
    ).toBeInTheDocument();
  });

  userEvent.type(tableSelect, 'Sheet3');

  await waitFor(() => {
    expect(
      screen.queryByRole('option', { name: /Sheet1/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /Sheet2/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', {
        name: /Sheet3/i,
      }),
    ).toBeInTheDocument();
  });
});

test('renders a warning icon when a table name has a pre-existing dataset', async () => {
  render(
    <LeftPanel
      setDataset={mockFun}
      dataset={exampleDataset[0]}
      datasetNames={['Sheet2']}
    />,
    {
      useRedux: true,
    },
  );

  // Click 'test-postgres' database to access schemas
  const databaseSelect = screen.getByRole('combobox', {
    name: /select database or type to search databases/i,
  });
  userEvent.click(databaseSelect);
  userEvent.click(await screen.findByText('test-postgres'));

  const schemaSelect = screen.getByRole('combobox', {
    name: /select schema or type to search schemas/i,
  });
  const tableSelect = screen.getByRole('combobox', {
    name: /select table or type to search tables/i,
  });

  await waitFor(() => expect(schemaSelect).toBeEnabled());

  // Warning icon should not show yet
  expect(
    screen.queryByRole('img', { name: 'warning' }),
  ).not.toBeInTheDocument();

  // Click 'public' schema to access tables
  userEvent.click(schemaSelect);
  userEvent.click(screen.getAllByText('public')[1]);
  userEvent.click(tableSelect);

  await waitFor(() => {
    expect(
      screen.queryByRole('option', {
        name: /Sheet2/i,
      }),
    ).toBeInTheDocument();
  });

  userEvent.type(tableSelect, 'Sheet2');

  // Sheet2 should now show the warning icon
  expect(screen.getByRole('img', { name: 'alert-solid' })).toBeInTheDocument();
});
