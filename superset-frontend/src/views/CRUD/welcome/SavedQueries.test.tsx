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
import thunk from 'redux-thunk';
import { styledMount as mount } from 'spec/helpers/theming';
import fetchMock from 'fetch-mock';
import configureStore from 'redux-mock-store';
import { act } from 'react-dom/test-utils';

import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import SubMenu from 'src/components/Menu/SubMenu';
import SavedQueries from 'src/views/CRUD/welcome/SavedQueries';

// store needed for withToasts(DashboardTable)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const queriesEndpoint = 'glob:*/api/v1/saved_query/?*';
const savedQueriesInfo = 'glob:*/api/v1/saved_query/_info*';

const mockqueries = [...new Array(3)].map((_, i) => ({
  created_by: {
    id: i,
    first_name: `user`,
    last_name: `${i}`,
  },
  created_on: `${i}-2020`,
  database: {
    database_name: `db ${i}`,
    id: i,
  },
  changed_on_delta_humanized: '1 day ago',
  db_id: i,
  description: `SQL for ${i}`,
  id: i,
  label: `query ${i}`,
  schema: 'public',
  sql: `SELECT ${i} FROM table`,
  sql_tables: [
    {
      catalog: null,
      schema: null,
      table: `${i}`,
    },
  ],
}));

fetchMock.get(queriesEndpoint, {
  result: mockqueries,
});

fetchMock.get(savedQueriesInfo, {
  permissions: ['can_list', 'can_edit', 'can_delete'],
});

describe('SavedQueries', () => {
  const savedQueryProps = {
    user: {
      userId: '1',
    },
    mine: mockqueries,
  };

  const wrapper = mount(<SavedQueries store={store} {...savedQueryProps} />);

  const clickTab = (idx: number) => {
    act(() => {
      const handler = wrapper.find('li.no-router a').at(idx).prop('onClick');
      if (handler) {
        handler({} as any);
      }
    });
  };

  beforeAll(async () => {
    await waitForComponentToPaint(wrapper);
  });

  it('is valid', () => {
    expect(wrapper.find(SavedQueries)).toExist();
  });

  it('fetches queries mine and renders listviewcard cards', async () => {
    clickTab(0);
    await waitForComponentToPaint(wrapper);
    expect(fetchMock.calls(/saved_query\/\?q/)).toHaveLength(1);
    expect(wrapper.find('ListViewCard')).toExist();
  });

  it('renders a submenu with clickable tables and buttons', async () => {
    expect(wrapper.find(SubMenu)).toExist();
    expect(wrapper.find('li')).toHaveLength(1);
    expect(wrapper.find('button')).toHaveLength(2);
    clickTab(0);
    await waitForComponentToPaint(wrapper);
    expect(fetchMock.calls(/saved_query\/\?q/)).toHaveLength(2);
  });
});
