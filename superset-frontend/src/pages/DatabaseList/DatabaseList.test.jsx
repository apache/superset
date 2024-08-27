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
import { Provider } from 'react-redux';
import { styledMount as mount } from 'spec/helpers/theming';

import DatabaseList from 'src/pages/DatabaseList';
import DatabaseModal from 'src/features/databases/DatabaseModal';
import DeleteModal from 'src/components/DeleteModal';
import SubMenu from 'src/features/home/SubMenu';
import ListView from 'src/components/ListView';
import Filters from 'src/components/ListView/Filters';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { act } from 'react-dom/test-utils';

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

describe('Admin DatabaseList', () => {
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

  const wrapper = mount(
    <Provider store={store}>
      <DatabaseList />
    </Provider>,
  );

  beforeAll(async () => {
    await waitForComponentToPaint(wrapper);
  });

  test('renders', () => {
    expect(wrapper.find(DatabaseList)).toExist();
  });

  test('renders a SubMenu', () => {
    expect(wrapper.find(SubMenu)).toExist();
  });

  test('renders a SubMenu with no tabs', () => {
    expect(wrapper.find(SubMenu).props().tabs).toBeUndefined();
  });

  test('renders a DatabaseModal', () => {
    expect(wrapper.find(DatabaseModal)).toExist();
  });

  test('renders a ListView', () => {
    expect(wrapper.find(ListView)).toExist();
  });

  test('fetches Databases', () => {
    const callsD = fetchMock.calls(/database\/\?q/);
    expect(callsD).toHaveLength(2);
    expect(callsD[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/database/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25)"`,
    );
  });

  test('deletes', async () => {
    act(() => {
      wrapper.find('[data-test="database-delete"]').first().props().onClick();
    });
    await waitForComponentToPaint(wrapper);

    expect(wrapper.find(DeleteModal).props().description).toMatchSnapshot();

    act(() => {
      wrapper
        .find('#delete')
        .first()
        .props()
        .onChange({ target: { value: 'DELETE' } });
    });
    await waitForComponentToPaint(wrapper);
    act(() => {
      wrapper.find('button').last().props().onClick();
    });

    await waitForComponentToPaint(wrapper);

    expect(fetchMock.calls(/database\/0\/related_objects/, 'GET')).toHaveLength(
      1,
    );
    expect(fetchMock.calls(/database\/0/, 'DELETE')).toHaveLength(1);
  });

  test('filters', async () => {
    const filtersWrapper = wrapper.find(Filters);
    act(() => {
      filtersWrapper
        .find('[name="expose_in_sqllab"]')
        .first()
        .props()
        .onSelect({ label: 'Yes', value: true });

      filtersWrapper
        .find('[name="allow_run_async"]')
        .first()
        .props()
        .onSelect({ label: 'Yes', value: false });

      filtersWrapper
        .find('[name="database_name"]')
        .first()
        .props()
        .onSubmit('fooo');
    });
    await waitForComponentToPaint(wrapper);

    expect(fetchMock.lastCall()[0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/database/?q=(filters:!((col:database_name,opr:ct,value:fooo),(col:expose_in_sqllab,opr:eq,value:!t),(col:allow_run_async,opr:eq,value:!f)),order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25)"`,
    );
  });

  test('should not render dropdown menu button if user is not admin', async () => {
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
    const newWrapper = mount(
      <Provider store={store}>
        <DatabaseList />
      </Provider>,
    );
    await waitForComponentToPaint(newWrapper);

    expect(newWrapper.find('.dropdown-menu-links')).not.toExist();
  });
});
