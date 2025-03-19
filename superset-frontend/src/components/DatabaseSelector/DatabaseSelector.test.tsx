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

import { act } from 'react-dom/test-utils';
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  waitFor,
  defaultStore as store,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { api } from 'src/hooks/apiResources/queryApi';
import DatabaseSelector, { DatabaseSelectorProps } from '.';
import { EmptyStateSmall } from '../EmptyState';

const createProps = (): DatabaseSelectorProps => ({
  db: {
    id: 1,
    database_name: 'test',
    backend: 'test-postgresql',
  },
  formMode: false,
  isDatabaseSelectEnabled: true,
  readOnly: false,
  catalog: null,
  schema: 'public',
  sqlLabMode: true,
  getDbList: jest.fn(),
  handleError: jest.fn(),
  onDbChange: jest.fn(),
  onSchemaChange: jest.fn(),
});

const fakeDatabaseApiResult = {
  count: 2,
  description_columns: {},
  ids: [1, 2],
  label_columns: {
    allow_file_upload: 'Allow Csv Upload',
    allow_ctas: 'Allow Ctas',
    allow_cvas: 'Allow Cvas',
    allow_dml: 'Allow DDL and DML',
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
};

const fakeDatabaseApiResultInReverseOrder = {
  ...fakeDatabaseApiResult,
  ids: [2, 1],
  result: [...fakeDatabaseApiResult.result].reverse(),
};

const fakeSchemaApiResult = {
  count: 2,
  result: ['information_schema', 'public'],
};

const fakeCatalogApiResult = {
  count: 0,
  result: [],
};

const fakeFunctionNamesApiResult = {
  function_names: [],
};

const databaseApiRoute =
  'glob:*/api/v1/database/?*order_column:database_name,order_direction*';
const catalogApiRoute = 'glob:*/api/v1/database/*/catalogs/?*';
const schemaApiRoute = 'glob:*/api/v1/database/*/schemas/?*';
const tablesApiRoute = 'glob:*/api/v1/database/*/tables/*';

function setupFetchMock() {
  fetchMock.get(databaseApiRoute, fakeDatabaseApiResult);
  fetchMock.get(catalogApiRoute, fakeCatalogApiResult);
  fetchMock.get(schemaApiRoute, fakeSchemaApiResult);
  fetchMock.get(tablesApiRoute, fakeFunctionNamesApiResult);
}

beforeEach(() => {
  setupFetchMock();
});

afterEach(() => {
  fetchMock.reset();
  act(() => {
    store.dispatch(api.util.resetApiState());
  });
});

test('Should render', async () => {
  const props = createProps();
  render(<DatabaseSelector {...props} />, { useRedux: true, store });
  expect(await screen.findByTestId('DatabaseSelector')).toBeInTheDocument();
});

test('Refresh should work', async () => {
  const props = createProps();

  render(<DatabaseSelector {...props} />, { useRedux: true, store });

  expect(fetchMock.calls(schemaApiRoute).length).toBe(0);

  const select = screen.getByRole('combobox', {
    name: 'Select schema or type to search schemas',
  });

  userEvent.click(select);

  await waitFor(() => {
    expect(fetchMock.calls(databaseApiRoute).length).toBe(1);
    expect(fetchMock.calls(schemaApiRoute).length).toBe(1);
    expect(props.handleError).toBeCalledTimes(0);
    expect(props.onDbChange).toBeCalledTimes(0);
    expect(props.onSchemaChange).toBeCalledTimes(0);
  });

  // click schema reload
  userEvent.click(screen.getByRole('button', { name: 'refresh' }));

  await waitFor(() => {
    expect(fetchMock.calls(databaseApiRoute).length).toBe(1);
    expect(fetchMock.calls(schemaApiRoute).length).toBe(2);
    expect(props.handleError).toBeCalledTimes(0);
    expect(props.onDbChange).toBeCalledTimes(0);
    expect(props.onSchemaChange).toBeCalledTimes(0);
  });
});

test('Should database select display options', async () => {
  const props = createProps();
  render(<DatabaseSelector {...props} />, { useRedux: true, store });
  const select = screen.getByRole('combobox', {
    name: 'Select database or type to search databases',
  });
  expect(select).toBeInTheDocument();
  userEvent.click(select);
  expect(await screen.findByText('test-mysql')).toBeInTheDocument();
});

test('should display options in order of the api response', async () => {
  fetchMock.get(databaseApiRoute, fakeDatabaseApiResultInReverseOrder, {
    overwriteRoutes: true,
  });
  const props = createProps();
  render(<DatabaseSelector {...props} db={undefined} />, {
    useRedux: true,
    store,
  });
  const select = screen.getByRole('combobox', {
    name: 'Select database or type to search databases',
  });
  expect(select).toBeInTheDocument();
  userEvent.click(select);
  const options = await screen.findAllByRole('option');

  expect(options[0]).toHaveTextContent(
    `${fakeDatabaseApiResultInReverseOrder.result[0].id}`,
  );
  expect(options[1]).toHaveTextContent(
    `${fakeDatabaseApiResultInReverseOrder.result[1].id}`,
  );
});

test('Should fetch the search keyword when total count exceeds initial options', async () => {
  fetchMock.get(
    databaseApiRoute,
    {
      ...fakeDatabaseApiResult,
      count: fakeDatabaseApiResult.result.length + 1,
    },
    { overwriteRoutes: true },
  );

  const props = createProps();
  render(<DatabaseSelector {...props} />, { useRedux: true, store });
  const select = screen.getByRole('combobox', {
    name: 'Select database or type to search databases',
  });
  await waitFor(() =>
    expect(fetchMock.calls(databaseApiRoute)).toHaveLength(1),
  );
  expect(select).toBeInTheDocument();
  userEvent.type(select, 'keywordtest');
  await waitFor(() =>
    expect(fetchMock.calls(databaseApiRoute)).toHaveLength(2),
  );
  expect(fetchMock.calls(databaseApiRoute)[1][0]).toContain('keywordtest');
});

test('should show empty state if there are no options', async () => {
  fetchMock.reset();
  fetchMock.get(databaseApiRoute, { result: [] });
  fetchMock.get(schemaApiRoute, { result: [] });
  fetchMock.get(tablesApiRoute, { result: [] });
  const props = createProps();
  render(
    <DatabaseSelector
      {...props}
      db={undefined}
      emptyState={<EmptyStateSmall title="empty" image="" />}
    />,
    { useRedux: true, store },
  );
  const select = screen.getByRole('combobox', {
    name: 'Select database or type to search databases',
  });
  userEvent.click(select);
  const emptystate = await screen.findByText('empty');
  expect(emptystate).toBeInTheDocument();
  expect(screen.queryByText('test-mysql')).not.toBeInTheDocument();
});

test('Should schema select display options', async () => {
  const props = createProps();
  render(<DatabaseSelector {...props} />, { useRedux: true, store });
  const select = screen.getByRole('combobox', {
    name: 'Select schema or type to search schemas',
  });
  expect(select).toBeInTheDocument();
  userEvent.click(select);
  expect(
    await screen.findByRole('option', { name: 'public' }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('option', { name: 'information_schema' }),
  ).toBeInTheDocument();
});

test('Sends the correct db when changing the database', async () => {
  const props = createProps();
  render(<DatabaseSelector {...props} />, { useRedux: true, store });
  const select = screen.getByRole('combobox', {
    name: 'Select database or type to search databases',
  });
  expect(select).toBeInTheDocument();
  userEvent.click(select);
  userEvent.click(await screen.findByText('test-mysql'));
  await waitFor(() =>
    expect(props.onDbChange).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 2,
        database_name: 'test-mysql',
        backend: 'mysql',
      }),
    ),
  );
});

test('Sends the correct schema when changing the schema', async () => {
  const props = createProps();
  const { rerender } = render(<DatabaseSelector {...props} db={null} />, {
    useRedux: true,
    store,
  });
  await waitFor(() => expect(fetchMock.calls(databaseApiRoute).length).toBe(1));
  rerender(<DatabaseSelector {...props} />);
  expect(props.onSchemaChange).toHaveBeenCalledTimes(0);
  const select = screen.getByRole('combobox', {
    name: 'Select schema or type to search schemas',
  });
  expect(select).toBeInTheDocument();
  userEvent.click(select);
  const schemaOption = await screen.findAllByText('information_schema');
  userEvent.click(schemaOption[1]);
  await waitFor(() =>
    expect(props.onSchemaChange).toHaveBeenCalledWith('information_schema'),
  );
  expect(props.onSchemaChange).toHaveBeenCalledTimes(1);
});
