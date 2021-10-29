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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';
import userEvent from '@testing-library/user-event';
import DatabaseSelector from '.';

const SupersetClientGet = jest.spyOn(SupersetClient, 'get');

const createProps = () => ({
  db: {
    id: 1,
    database_name: 'test',
    backend: 'test-postgresql',
    allow_multi_schema_metadata_fetch: false,
  },
  formMode: false,
  isDatabaseSelectEnabled: true,
  readOnly: false,
  schema: undefined,
  sqlLabMode: true,
  getDbList: jest.fn(),
  getTableList: jest.fn(),
  handleError: jest.fn(),
  onDbChange: jest.fn(),
  onSchemaChange: jest.fn(),
  onSchemasLoad: jest.fn(),
  onUpdate: jest.fn(),
});

beforeEach(() => {
  jest.resetAllMocks();
  SupersetClientGet.mockImplementation(
    async ({ endpoint }: { endpoint: string }) => {
      if (endpoint.includes('schemas')) {
        return {
          json: { result: ['information_schema', 'public'] },
        } as any;
      }
      if (endpoint.includes('/function_names')) {
        return {
          json: { function_names: [] },
        } as any;
      }
      return {
        json: {
          count: 2,
          description_columns: {},
          ids: [1, 2],
          label_columns: {
            allow_csv_upload: 'Allow Csv Upload',
            allow_ctas: 'Allow Ctas',
            allow_cvas: 'Allow Cvas',
            allow_dml: 'Allow Dml',
            allow_multi_schema_metadata_fetch:
              'Allow Multi Schema Metadata Fetch',
            allow_run_async: 'Allow Run Async',
            allows_cost_estimate: 'Allows Cost Estimate',
            allows_subquery: 'Allows Subquery',
            allows_virtual_table_explore: 'Allows Virtual Table Explore',
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
            'allow_csv_upload',
            'allow_ctas',
            'allow_cvas',
            'allow_dml',
            'allow_multi_schema_metadata_fetch',
            'allow_run_async',
            'allows_cost_estimate',
            'allows_subquery',
            'allows_virtual_table_explore',
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
            'allow_csv_upload',
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
              allow_csv_upload: false,
              allow_ctas: false,
              allow_cvas: false,
              allow_dml: false,
              allow_multi_schema_metadata_fetch: false,
              allow_run_async: false,
              allows_cost_estimate: null,
              allows_subquery: true,
              allows_virtual_table_explore: true,
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
        },
      } as any;
    },
  );
});

test('Should render', async () => {
  const props = createProps();
  render(<DatabaseSelector {...props} />);
  expect(await screen.findByTestId('DatabaseSelector')).toBeInTheDocument();
});

test('Refresh should work', async () => {
  const props = createProps();

  render(<DatabaseSelector {...props} />);

  const select = screen.getByRole('combobox', {
    name: 'Select schema or type schema name',
  });

  userEvent.click(select);

  await waitFor(() => {
    expect(SupersetClientGet).toBeCalledTimes(2);
    expect(props.getDbList).toBeCalledTimes(0);
    expect(props.getTableList).toBeCalledTimes(0);
    expect(props.handleError).toBeCalledTimes(0);
    expect(props.onDbChange).toBeCalledTimes(0);
    expect(props.onSchemaChange).toBeCalledTimes(0);
    expect(props.onSchemasLoad).toBeCalledTimes(0);
    expect(props.onUpdate).toBeCalledTimes(0);
  });

  userEvent.click(screen.getByRole('button', { name: 'refresh' }));

  await waitFor(() => {
    expect(SupersetClientGet).toBeCalledTimes(3);
    expect(props.getDbList).toBeCalledTimes(1);
    expect(props.getTableList).toBeCalledTimes(0);
    expect(props.handleError).toBeCalledTimes(0);
    expect(props.onDbChange).toBeCalledTimes(0);
    expect(props.onSchemaChange).toBeCalledTimes(0);
    expect(props.onSchemasLoad).toBeCalledTimes(2);
    expect(props.onUpdate).toBeCalledTimes(0);
  });
});

test('Should database select display options', async () => {
  const props = createProps();
  render(<DatabaseSelector {...props} />);
  const select = screen.getByRole('combobox', {
    name: 'Select database or type database name',
  });
  expect(select).toBeInTheDocument();
  userEvent.click(select);
  expect(await screen.findByText('test-mysql')).toBeInTheDocument();
});

test('Should schema select display options', async () => {
  const props = createProps();
  render(<DatabaseSelector {...props} />);
  const select = screen.getByRole('combobox', {
    name: 'Select schema or type schema name',
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
  render(<DatabaseSelector {...props} />);
  const select = screen.getByRole('combobox', {
    name: 'Select database or type database name',
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
        allow_multi_schema_metadata_fetch: false,
      }),
    ),
  );
});

test('Sends the correct schema when changing the schema', async () => {
  const props = createProps();
  render(<DatabaseSelector {...props} />);
  const select = screen.getByRole('combobox', {
    name: 'Select schema or type schema name',
  });
  expect(select).toBeInTheDocument();
  userEvent.click(select);
  const schemaOption = await screen.findAllByText('information_schema');
  userEvent.click(schemaOption[1]);
  await waitFor(() =>
    expect(props.onSchemaChange).toHaveBeenCalledWith('information_schema'),
  );
});
