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

import userEvent from '@testing-library/user-event';
import { screen, waitFor, render } from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { createMemoryHistory } from 'history';
import { ChartCreation } from 'src/pages/ChartCreation';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';

jest.mock('src/components/DynamicPlugins', () => ({
  usePluginContext: () => ({
    mountedPluginMetadata: { table: { name: 'Table', tags: [] } },
  }),
}));

const mockDatasourceResponse = {
  result: [
    {
      id: 1,
      table_name: 'table',
      datasource_type: 'table',
      database: { database_name: 'test_db' },
      schema: 'public',
    },
  ],
  count: 1,
};

fetchMock.get(/\/api\/v1\/dataset\/\?q=.*/, {
  body: mockDatasourceResponse,
  status: 200,
});

const mockUser: UserWithPermissionsAndRoles = {
  createdOn: '2021-04-27T18:12:38.952304',
  email: 'admin',
  firstName: 'admin',
  isActive: true,
  lastName: 'admin',
  permissions: {},
  roles: { Admin: Array(173) },
  userId: 1,
  username: 'admin',
  isAnonymous: false,
};

const mockUserWithDatasetWrite: UserWithPermissionsAndRoles = {
  createdOn: '2021-04-27T18:12:38.952304',
  email: 'admin',
  firstName: 'admin',
  isActive: true,
  lastName: 'admin',
  permissions: {},
  roles: { Admin: [['can_write', 'Dataset']] },
  userId: 1,
  username: 'admin',
  isAnonymous: false,
};
const history = createMemoryHistory();

history.push = jest.fn();

const routeProps = {
  history,
  location: {} as any,
  match: {} as any,
};

const renderOptions = {
  useRouter: true,
};

async function renderComponent(user = mockUser) {
  render(
    <ChartCreation user={user} addSuccessToast={() => null} {...routeProps} />,
    renderOptions,
  );
  await waitFor(() => new Promise(resolve => setTimeout(resolve, 0)));
}

test('renders a select and a VizTypeGallery', async () => {
  await renderComponent();
  expect(screen.getByRole('combobox', { name: 'Dataset' })).toBeInTheDocument();
  expect(screen.getByText(/choose chart type/i)).toBeInTheDocument();
});

test('renders dataset help text when user lacks dataset write permissions', async () => {
  await renderComponent();
  expect(screen.queryByText('Add a dataset')).not.toBeInTheDocument();
  expect(screen.getByText('view instructions')).toBeInTheDocument();
});

test('renders dataset help text when user has dataset write permissions', async () => {
  await renderComponent(mockUserWithDatasetWrite);
  expect(screen.getByText('Add a dataset')).toBeInTheDocument();
  expect(screen.queryByText('view instructions')).toBeInTheDocument();
});

test('renders create chart button', async () => {
  await renderComponent();
  expect(
    screen.getByRole('button', { name: 'Create new chart' }),
  ).toBeInTheDocument();
});

test('renders a disabled button if no datasource is selected', async () => {
  await renderComponent();
  expect(
    screen.getByRole('button', { name: 'Create new chart' }),
  ).toBeDisabled();
});

test('renders an enabled button if datasource and viz type are selected', async () => {
  await renderComponent();

  const datasourceSelect = screen.getByRole('combobox', { name: 'Dataset' });
  userEvent.click(datasourceSelect);
  userEvent.click(await screen.findByText(/test_db/i));

  userEvent.click(
    screen.getByRole('button', {
      name: /ballot all charts/i,
    }),
  );
  userEvent.click(await screen.findByText('Table'));

  expect(
    screen.getByRole('button', { name: 'Create new chart' }),
  ).toBeEnabled();
});

test('double-click viz type does nothing if no datasource is selected', async () => {
  await renderComponent();

  userEvent.click(
    screen.getByRole('button', {
      name: /ballot all charts/i,
    }),
  );
  userEvent.dblClick(await screen.findByText('Table'));

  expect(
    screen.getByRole('button', { name: 'Create new chart' }),
  ).toBeDisabled();
  expect(history.push).not.toHaveBeenCalled();
});

test('double-click viz type submits with formatted URL if datasource is selected', async () => {
  await renderComponent();

  const datasourceSelect = screen.getByRole('combobox', { name: 'Dataset' });
  userEvent.click(datasourceSelect);
  userEvent.click(await screen.findByText(/test_db/i));

  userEvent.click(
    screen.getByRole('button', {
      name: /ballot all charts/i,
    }),
  );
  userEvent.dblClick(await screen.findByText('Table'));

  expect(
    screen.getByRole('button', { name: 'Create new chart' }),
  ).toBeEnabled();
  const formattedUrl = '/explore/?viz_type=table&datasource=1__table';
  expect(history.push).toHaveBeenCalledWith(formattedUrl);
});
