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
import { SupersetClient } from '@superset-ui/core';
// import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within } from 'spec/helpers/testing-library';
import LeftPanel from 'src/views/CRUD/data/dataset/AddDataset/LeftPanel';

// const tablesEndpoint = 'glob:*/superset/tables*';

// fetchMock.get(tablesEndpoint, {
//   tableLength: 1,
//   options: [{ value: 'Sheet1', type: 'table', extra: null }],
// });

describe('LeftPanel', () => {
  const mockFun = jest.fn();

  const SupersetClientGet = jest.spyOn(SupersetClient, 'get');

  beforeEach(() => {
    jest.resetAllMocks();
    SupersetClientGet.mockImplementation(
      async ({ endpoint }: { endpoint: string }) => {
        console.log('FINDME TEST', endpoint);
        if (endpoint.includes('schemas')) {
          return {
            json: { result: ['information_schema', 'public'] },
          } as any;
        }
        if (endpoint.includes('tables')) {
          return {
            tableLength: 1,
            options: [{ value: 'Sheet1', type: 'table', extra: null }],
          };
        }
        return {
          json: {
            count: 2,
            description_columns: {},
            ids: [1, 2],
            label_columns: {
              allow_file_upload: 'Allow Csv Upload',
              allow_ctas: 'Allow Ctas',
              allow_cvas: 'Allow Cvas',
              allow_dml: 'Allow Dml',
              allow_multi_schema_metadata_fetch:
                'Allow Multi Schema Metadata Fetch',
              allow_run_async: 'Allow Run Async',
              allows_cost_estimate: 'Allows Cost Estimate',
              allows_subquery: 'Allows Subquery',
              allows_virtual_table_explore: 'Allows Virtual Table Explore',
              disable_data_preview: 'Disables SQL Lab Data Preview',
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

  const getTableMockFunction = async () =>
    ({
      tableLength: 1,
      options: [{ value: 'Sheet1', type: 'table', extra: null }],
    } as any);

  test('should render', async () => {
    render(<LeftPanel setDataset={mockFun} />, {
      useRedux: true,
    });
    expect(
      await screen.findByText(/select database & schema/i),
    ).toBeInTheDocument();
  });

  test('should render schema selector, databa selector container, and selects', async () => {
    render(<LeftPanel setDataset={mockFun} />, { useRedux: true });

    expect(await screen.findByText(/select database & schema/i)).toBeVisible();

    const databaseSelect = screen.getByRole('combobox', {
      name: 'Select database or type database name',
    });
    const schemaSelect = screen.getByRole('combobox', {
      name: 'Select schema or type schema name',
    });
    expect(databaseSelect).toBeInTheDocument();
    expect(schemaSelect).toBeInTheDocument();
  });

  test('does not render blank state if there is nothing selected', async () => {
    render(<LeftPanel setDataset={mockFun} />, { useRedux: true });

    expect(
      await screen.findByText(/select database & schema/i),
    ).toBeInTheDocument();
    const emptyState = screen.queryByRole('img', { name: /empty/i });
    expect(emptyState).not.toBeInTheDocument();
  });

  test('renders list of options when user clicks on schema', async () => {
    render(<LeftPanel setDataset={mockFun} schema="schema_a" dbId={1} />, {
      useRedux: true,
    });

    // Click 'test-postgres' database to access schemas
    const databaseSelect = screen.getByRole('combobox', {
      name: 'Select database or type database name',
    });
    // Schema select should be disabled until database is selected
    const schemaSelect = screen.getByRole('combobox', {
      name: /select schema or type schema name/i,
    });
    userEvent.click(databaseSelect);
    expect(await screen.findByText('test-postgres')).toBeInTheDocument();
    expect(schemaSelect).toBeDisabled();
    userEvent.click(screen.getByText('test-postgres'));
    // screen.debug(databaseSelect);
    // userEvent.selectOptions(databaseSelect, 'test-postgres');

    // Wait for schema field to be enabled
    await waitFor(() => {
      expect(schemaSelect).toBeEnabled();
    });
    const lbs = screen.getAllByRole('listbox');
    const cbs = screen.getAllByRole('combobox');
    const options = screen.getAllByRole('option');

    // userEvent.selectOptions(schemaSelect, '');
    screen.debug(within(lbs[0]).getAllByRole('option')[1]);
    userEvent.click(within(lbs[0]).getAllByRole('option')[1]);
    // await waitFor(() =>
    //   expect(screen.getByRole('option', { name: 'public' })).toBeVisible(),
    // );
    // // screen.debug(screen.getByRole('option', { name: 'information_schema' }));
    // expect(
    //   await screen.findByRole('option', { name: 'information_schema' }),
    // ).toBeVisible();
    // expect(await screen.findByRole('option', { name: 'public' })).toBeVisible();

    // SupersetClientGet.mockImplementation(await getTableMockFunction());
    // screen.logTestingPlaygroundURL();

    // userEvent.click(screen.getByRole('option', { name: '2' }));
    // screen.logTestingPlaygroundURL();

    // // Todo: (Phillip) finish testing for showing list of options once table is implemented
    // // screen.debug(screen.getByText('table_a'));
    // screen.debug(screen.getAllByRole('option'));
    // userEvent.selectOptions(
    //   schemaSelect,
    //   screen.getByRole('option', { name: 'public' }),
    // );
    // screen.logTestingPlaygroundURL();
    // screen.debug(screen.getByTestId('options-list'));
    // expect(screen.getByTestId('options-list')).toBeInTheDocument();
  });
});
