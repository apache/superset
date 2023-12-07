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
import { Route } from 'react-router-dom';
import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import { DatasourceType, JsonObject, SupersetClient } from '@superset-ui/core';
import { render, screen, act, waitFor } from 'spec/helpers/testing-library';
import { fallbackExploreInitialData } from 'src/explore/fixtures';
import DatasourceControl from '.';

const SupersetClientGet = jest.spyOn(SupersetClient, 'get');

const mockDatasource = {
  id: 25,
  database: {
    name: 'examples',
  },
  name: 'channels',
  type: 'table',
  columns: [],
  owners: [{ first_name: 'john', last_name: 'doe', id: 1, username: 'jd' }],
  sql: 'SELECT * FROM mock_datasource_sql',
};
const createProps = (overrides: JsonObject = {}) => ({
  hovered: false,
  type: 'DatasourceControl',
  label: 'Datasource',
  default: null,
  description: null,
  value: '25__table',
  form_data: {},
  datasource: mockDatasource,
  validationErrors: [],
  name: 'datasource',
  actions: {
    changeDatasource: jest.fn(),
    setControlValue: jest.fn(),
  },
  isEditable: true,
  user: {
    createdOn: '2021-04-27T18:12:38.952304',
    email: 'admin',
    firstName: 'admin',
    isActive: true,
    lastName: 'admin',
    permissions: {},
    roles: { Admin: Array(173) },
    userId: 1,
    username: 'admin',
  },
  onChange: jest.fn(),
  onDatasourceSave: jest.fn(),
  ...overrides,
});

async function openAndSaveChanges(datasource: any) {
  fetchMock.put(
    'glob:*/api/v1/dataset/*',
    {},
    {
      overwriteRoutes: true,
    },
  );
  fetchMock.get(
    'glob:*/api/v1/dataset/*',
    { result: datasource },
    {
      overwriteRoutes: true,
    },
  );
  userEvent.click(screen.getByTestId('datasource-menu-trigger'));
  userEvent.click(await screen.findByTestId('edit-dataset'));
  userEvent.click(await screen.findByTestId('datasource-modal-save'));
  userEvent.click(await screen.findByText('OK'));
}

test('Should render', async () => {
  const props = createProps();
  render(<DatasourceControl {...props} />, { useRouter: true });
  expect(await screen.findByTestId('datasource-control')).toBeVisible();
});

test('Should have elements', async () => {
  const props = createProps();
  render(<DatasourceControl {...props} />, { useRouter: true });
  expect(await screen.findByText('channels')).toBeVisible();
  expect(screen.getByTestId('datasource-menu-trigger')).toBeVisible();
});

test('Should open a menu', async () => {
  const props = createProps();
  render(<DatasourceControl {...props} />, { useRouter: true });

  expect(screen.queryByText('Edit dataset')).not.toBeInTheDocument();
  expect(screen.queryByText('Swap dataset')).not.toBeInTheDocument();
  expect(screen.queryByText('View in SQL Lab')).not.toBeInTheDocument();

  userEvent.click(screen.getByTestId('datasource-menu-trigger'));

  expect(await screen.findByText('Edit dataset')).toBeInTheDocument();
  expect(screen.getByText('Swap dataset')).toBeInTheDocument();
  expect(screen.getByText('View in SQL Lab')).toBeInTheDocument();
});

test('Should not show SQL Lab for non sql_lab role', async () => {
  const props = createProps({
    user: {
      createdOn: '2021-04-27T18:12:38.952304',
      email: 'gamma',
      firstName: 'gamma',
      isActive: true,
      lastName: 'gamma',
      permissions: {},
      roles: { Gamma: [] },
      userId: 2,
      username: 'gamma',
    },
  });
  render(<DatasourceControl {...props} />, { useRouter: true });

  userEvent.click(screen.getByTestId('datasource-menu-trigger'));

  expect(await screen.findByText('Edit dataset')).toBeInTheDocument();
  expect(screen.getByText('Swap dataset')).toBeInTheDocument();
  expect(screen.queryByText('View in SQL Lab')).not.toBeInTheDocument();
});

test('Should show SQL Lab for sql_lab role', async () => {
  const props = createProps({
    user: {
      createdOn: '2021-04-27T18:12:38.952304',
      email: 'sql',
      firstName: 'sql',
      isActive: true,
      lastName: 'sql',
      permissions: {},
      roles: { Gamma: [], sql_lab: [['menu_access', 'SQL Lab']] },
      userId: 2,
      username: 'sql',
    },
  });
  render(<DatasourceControl {...props} />, { useRouter: true });

  userEvent.click(screen.getByTestId('datasource-menu-trigger'));

  expect(await screen.findByText('Edit dataset')).toBeInTheDocument();
  expect(screen.getByText('Swap dataset')).toBeInTheDocument();
  expect(screen.getByText('View in SQL Lab')).toBeInTheDocument();
});

test('Click on Swap dataset option', async () => {
  const props = createProps();
  SupersetClientGet.mockImplementationOnce(
    async ({ endpoint }: { endpoint: string }) => {
      if (endpoint.includes('_info')) {
        return {
          json: { permissions: ['can_read', 'can_write'] },
        } as any;
      }
      return { json: { result: [] } } as any;
    },
  );

  render(<DatasourceControl {...props} />, {
    useRedux: true,
    useRouter: true,
  });
  userEvent.click(screen.getByTestId('datasource-menu-trigger'));

  await act(async () => {
    userEvent.click(screen.getByText('Swap dataset'));
  });
  expect(
    screen.getByText(
      'Changing the dataset may break the chart if the chart relies on columns or metadata that does not exist in the target dataset',
    ),
  ).toBeInTheDocument();
});

test('Click on Edit dataset', async () => {
  const props = createProps();
  SupersetClientGet.mockImplementationOnce(
    async () => ({ json: { result: [] } } as any),
  );
  render(<DatasourceControl {...props} />, {
    useRedux: true,
    useRouter: true,
  });
  userEvent.click(screen.getByTestId('datasource-menu-trigger'));

  await act(async () => {
    userEvent.click(screen.getByText('Edit dataset'));
  });

  expect(
    screen.getByText(
      'Changing these settings will affect all charts using this dataset, including charts owned by other people.',
    ),
  ).toBeInTheDocument();
});

test('Edit dataset should be disabled when user is not admin', async () => {
  const props = createProps();
  // @ts-expect-error
  props.user.roles = {};
  props.datasource.owners = [];
  SupersetClientGet.mockImplementationOnce(
    async () => ({ json: { result: [] } } as any),
  );

  render(<DatasourceControl {...props} />, {
    useRedux: true,
    useRouter: true,
  });

  userEvent.click(screen.getByTestId('datasource-menu-trigger'));

  expect(await screen.findByTestId('edit-dataset')).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});

test('Click on View in SQL Lab', async () => {
  const props = createProps();

  const { queryByTestId, getByTestId } = render(
    <>
      <Route
        path="/sqllab"
        render={({ location }) => (
          <div data-test="mock-sqllab-route">
            {JSON.stringify(location.state)}
          </div>
        )}
      />
      <DatasourceControl {...props} />
    </>,
    {
      useRedux: true,
      useRouter: true,
    },
  );
  userEvent.click(screen.getByTestId('datasource-menu-trigger'));

  expect(queryByTestId('mock-sqllab-route')).not.toBeInTheDocument();

  await act(async () => {
    userEvent.click(screen.getByText('View in SQL Lab'));
  });

  expect(getByTestId('mock-sqllab-route')).toBeInTheDocument();
  expect(JSON.parse(`${getByTestId('mock-sqllab-route').textContent}`)).toEqual(
    {
      requestedQuery: {
        datasourceKey: `${mockDatasource.id}__${mockDatasource.type}`,
        sql: mockDatasource.sql,
      },
    },
  );
});

test('Should open a different menu when datasource=query', async () => {
  const props = createProps();
  const queryProps = {
    ...props,
    datasource: {
      ...props.datasource,
      type: DatasourceType.Query,
    },
  };
  render(<DatasourceControl {...queryProps} />, { useRouter: true });

  expect(screen.queryByText('Query preview')).not.toBeInTheDocument();
  expect(screen.queryByText('View in SQL Lab')).not.toBeInTheDocument();
  expect(screen.queryByText('Save as dataset')).not.toBeInTheDocument();

  userEvent.click(screen.getByTestId('datasource-menu-trigger'));

  expect(await screen.findByText('Query preview')).toBeInTheDocument();
  expect(screen.getByText('View in SQL Lab')).toBeInTheDocument();
  expect(screen.getByText('Save as dataset')).toBeInTheDocument();
});

test('Click on Save as dataset', async () => {
  const props = createProps();
  const queryProps = {
    ...props,
    datasource: {
      ...props.datasource,
      type: DatasourceType.Query,
    },
  };

  render(<DatasourceControl {...queryProps} />, {
    useRedux: true,
    useRouter: true,
  });
  userEvent.click(screen.getByTestId('datasource-menu-trigger'));
  userEvent.click(screen.getByText('Save as dataset'));

  // Renders a save dataset modal
  const saveRadioBtn = await screen.findByRole('radio', {
    name: /save as new/i,
  });
  const overwriteRadioBtn = screen.getByRole('radio', {
    name: /overwrite existing/i,
  });
  const dropdownField = screen.getByText(/select or type dataset name/i);
  expect(saveRadioBtn).toBeVisible();
  expect(overwriteRadioBtn).toBeVisible();
  expect(screen.getByRole('button', { name: /save/i })).toBeVisible();
  expect(screen.getByRole('button', { name: /close/i })).toBeVisible();
  expect(dropdownField).toBeVisible();
});

test('should set the default temporal column', async () => {
  const props = createProps();
  const overrideProps = {
    ...props,
    form_data: {
      granularity_sqla: 'test-col',
    },
    datasource: {
      ...props.datasource,
      main_dttm_col: 'test-default',
      columns: [
        {
          column_name: 'test-col',
          is_dttm: false,
        },
        {
          column_name: 'test-default',
          is_dttm: true,
        },
      ],
    },
  };
  render(<DatasourceControl {...props} {...overrideProps} />, {
    useRedux: true,
    useRouter: true,
  });

  await openAndSaveChanges(overrideProps.datasource);
  await waitFor(() => {
    expect(props.actions.setControlValue).toHaveBeenCalledWith(
      'granularity_sqla',
      'test-default',
    );
  });
});

test('should set the first available temporal column', async () => {
  const props = createProps();
  const overrideProps = {
    ...props,
    form_data: {
      granularity_sqla: 'test-col',
    },
    datasource: {
      ...props.datasource,
      main_dttm_col: null,
      columns: [
        {
          column_name: 'test-col',
          is_dttm: false,
        },
        {
          column_name: 'test-first',
          is_dttm: true,
        },
      ],
    },
  };
  render(<DatasourceControl {...props} {...overrideProps} />, {
    useRedux: true,
    useRouter: true,
  });

  await openAndSaveChanges(overrideProps.datasource);
  await waitFor(() => {
    expect(props.actions.setControlValue).toHaveBeenCalledWith(
      'granularity_sqla',
      'test-first',
    );
  });
});

test('should not set the temporal column', async () => {
  const props = createProps();
  const overrideProps = {
    ...props,
    form_data: {
      granularity_sqla: null,
    },
    datasource: {
      ...props.datasource,
      main_dttm_col: null,
      columns: [
        {
          column_name: 'test-col',
          is_dttm: false,
        },
        {
          column_name: 'test-col-2',
          is_dttm: false,
        },
      ],
    },
  };
  render(<DatasourceControl {...props} {...overrideProps} />, {
    useRedux: true,
    useRouter: true,
  });

  await openAndSaveChanges(overrideProps.datasource);
  await waitFor(() => {
    expect(props.actions.setControlValue).toHaveBeenCalledWith(
      'granularity_sqla',
      null,
    );
  });
});

test('should show missing params state', () => {
  const props = createProps({ datasource: fallbackExploreInitialData.dataset });
  render(<DatasourceControl {...props} />, { useRedux: true, useRouter: true });
  expect(screen.getByText(/missing dataset/i)).toBeVisible();
  expect(screen.getByText(/missing url parameters/i)).toBeVisible();
  expect(
    screen.getByText(
      /the url is missing the dataset_id or slice_id parameters\./i,
    ),
  ).toBeVisible();
});

test('should show missing dataset state', () => {
  // @ts-ignore
  delete window.location;
  // @ts-ignore
  window.location = { search: '?slice_id=152' };
  const props = createProps({ datasource: fallbackExploreInitialData.dataset });
  render(<DatasourceControl {...props} />, { useRedux: true, useRouter: true });
  expect(screen.getAllByText(/missing dataset/i)).toHaveLength(2);
  expect(
    screen.getByText(
      /the dataset linked to this chart may have been deleted\./i,
    ),
  ).toBeVisible();
});
