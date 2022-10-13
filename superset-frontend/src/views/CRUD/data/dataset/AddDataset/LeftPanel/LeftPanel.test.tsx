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
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import LeftPanel from 'src/views/CRUD/data/dataset/AddDataset/LeftPanel';

describe('LeftPanel', () => {
  const mockFun = jest.fn();

  const SupersetClientGet = jest.spyOn(SupersetClient, 'get');

  beforeEach(() => {
    jest.resetAllMocks();
    SupersetClientGet.mockImplementation(
      async ({ endpoint }: { endpoint: string }) => {
        if (endpoint.includes('schemas')) {
          return {
            json: { result: ['information_schema', 'public'] },
          } as any;
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
      json: {
        options: [
          { label: 'table_a', value: 'table_a' },
          { label: 'table_b', value: 'table_b' },
          { label: 'table_c', value: 'table_c' },
          { label: 'table_d', value: 'table_d' },
        ],
      },
    } as any);

  test('should render', async () => {
    const { container } = render(<LeftPanel setDataset={mockFun} />, {
      useRedux: true,
    });

    expect(
      await screen.findByText(/select database & schema/i),
    ).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  test('should render tableselector and databaselector container and selects', async () => {
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

    const databaseSelect = screen.getByRole('combobox', {
      name: 'Select database or type database name',
    });
    userEvent.click(databaseSelect);
    expect(await screen.findByText('test-postgres')).toBeInTheDocument();

    userEvent.click(screen.getAllByText('test-postgres')[0]);
    const tableSelect = screen.getByRole('combobox', {
      name: /select schema or type schema name/i,
    });

    await waitFor(() => {
      expect(tableSelect).toBeEnabled();
    });

    userEvent.click(tableSelect);
    expect(
      await screen.findByRole('option', { name: 'information_schema' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('option', { name: 'public' }),
    ).toBeInTheDocument();

    SupersetClientGet.mockImplementation(getTableMockFunction);

    // Todo: (Phillip) finish testing for showing list of options once table is implemented
    // userEvent.click(screen.getAllByText('public')[1]);
    // expect(screen.getByTestId('options-list')).toBeInTheDocument();
  });
});
