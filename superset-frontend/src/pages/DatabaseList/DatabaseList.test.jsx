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
import thunk from 'redux-thunk';
import * as reactRedux from 'react-redux';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import { MemoryRouter } from 'react-router-dom';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';

import DatabaseList from 'src/pages/DatabaseList';

// store needed for withToasts(DatabaseList)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const databasesInfoEndpoint = 'glob:*/api/v1/database/_info*';
const databasesEndpoint = 'glob:*/api/v1/database/?*';
const databaseEndpoint = 'glob:*/api/v1/database/*';
const databaseRelatedEndpoint = 'glob:*/api/v1/database/*/related_objects*';

const mockdatabases = [...new Array(3)].map((_, i) => ({
  changed_by: {
    first_name: `user`,
    last_name: `${i}`,
  },
  database_name: `db ${i}`,
  backend: 'postgresql',
  allow_run_async: true,
  allow_dml: false,
  allow_file_upload: true,
  expose_in_sqllab: false,
  changed_on_delta_humanized: `${i} day(s) ago`,
  changed_on: new Date().toISOString,
  id: i,
}));

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

fetchMock.get(databasesInfoEndpoint, {
  permissions: ['can_write'],
});
fetchMock.get(databasesEndpoint, {
  result: mockdatabases,
  database_count: 3,
});

fetchMock.delete(databaseEndpoint, {});
fetchMock.get(databaseRelatedEndpoint, {
  charts: {
    count: 0,
    result: [],
  },
  dashboards: {
    count: 0,
    result: [],
  },
  sqllab_tab_states: {
    count: 0,
    result: [],
  },
});

fetchMock.get(
  'glob:*api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))',
  {},
);

const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');
const userSelectorMock = jest.spyOn(reactRedux, 'useSelector');

describe('DatabaseList', () => {
  const renderList = () =>
    render(<DatabaseList />, {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      store,
    });

  beforeEach(() => {
    useSelectorMock.mockReturnValue({
      CSV_EXTENSIONS: ['csv'],
      EXCEL_EXTENSIONS: ['xls', 'xlsx'],
      COLUMNAR_EXTENSIONS: ['parquet', 'zip'],
      ALLOWED_EXTENSIONS: ['parquet', 'zip', 'xls', 'xlsx', 'csv'],
    });
    userSelectorMock.mockReturnValue({
      createdOn: '2021-04-27T18:12:38.952304',
      email: 'admin',
      firstName: 'admin',
      isActive: true,
      lastName: 'admin',
      permissions: {},
      roles: {
        Admin: [
          ['can_sqllab', 'Superset'],
          ['can_write', 'Dashboard'],
          ['can_write', 'Chart'],
        ],
      },
      userId: 1,
      username: 'admin',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    fetchMock.resetHistory();
  });

  it('renders', async () => {
    renderList();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('renders a SubMenu', async () => {
    renderList();
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
  });

  it('renders a DatabaseModal', async () => {
    renderList();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('fetches Databases', async () => {
    renderList();
    await waitFor(() => {
      const callsD = fetchMock.calls(/database\/\?q/);
      expect(callsD).toHaveLength(2);
      expect(callsD[0][0]).toMatchInlineSnapshot(
        `"http://localhost/api/v1/database/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25)"`,
      );
    });
  });

  it('deletes a database', async () => {
    renderList();

    // Wait for the list to load
    await screen.findByRole('table');

    // Click delete button
    const deleteButton = screen.getByTestId('database-delete');
    fireEvent.click(deleteButton);

    // Check delete modal content
    const deleteModal = await screen.findByRole('dialog');
    expect(deleteModal).toMatchSnapshot();

    // Type DELETE to confirm
    const input = screen.getByTestId('delete-modal-input');
    fireEvent.change(input, { target: { value: 'DELETE' } });

    // Click confirm button
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmButton);

    // Verify delete request was made
    await waitFor(() => {
      expect(fetchMock.calls(/database\/0\/related_objects/, 'GET')).toHaveLength(1);
      expect(fetchMock.calls(/database\/0/, 'DELETE')).toHaveLength(1);
    });
  });

  it('filters databases', async () => {
    renderList();

    // Wait for filters to load
    await screen.findByRole('table');

    // Set expose_in_sqllab filter
    const exposeSqlLabFilter = screen.getByRole('combobox', { name: /expose in sql lab/i });
    fireEvent.change(exposeSqlLabFilter, { target: { value: 'Yes' } });

    // Set allow_run_async filter
    const allowRunAsyncFilter = screen.getByRole('combobox', { name: /async query/i });
    fireEvent.change(allowRunAsyncFilter, { target: { value: 'No' } });

    // Set database_name filter
    const nameFilter = screen.getByPlaceholderText(/name/i);
    fireEvent.change(nameFilter, { target: { value: 'fooo' } });
    fireEvent.keyDown(nameFilter, { key: 'Enter', code: 'Enter' });

    // Verify filter request was made
    await waitFor(() => {
      expect(fetchMock.lastCall()[0]).toMatchInlineSnapshot(
        `"http://localhost/api/v1/database/?q=(filters:!((col:database_name,opr:ct,value:fooo),(col:expose_in_sqllab,opr:eq,value:!t),(col:allow_run_async,opr:eq,value:!f)),order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25)"`,
      );
    });
  });

  it('should not render dropdown menu button if user is not admin', async () => {
    userSelectorMock.mockReturnValue({
      createdOn: '2021-05-27T18:12:38.952304',
      email: 'alpha@gmail.com',
      firstName: 'alpha',
      isActive: true,
      lastName: 'alpha',
      permissions: {},
      roles: {
        Alpha: [
          ['can_sqllab', 'Superset'],
          ['can_write', 'Dashboard'],
          ['can_write', 'Chart'],
        ],
      },
      userId: 2,
      username: 'alpha',
    });

    renderList();
    await screen.findByRole('table');

    expect(screen.queryByTestId('dropdown-menu-links')).not.toBeInTheDocument();
  });
});
