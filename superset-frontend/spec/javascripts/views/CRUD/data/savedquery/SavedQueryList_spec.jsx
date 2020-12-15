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
import configureStore from 'redux-mock-store';
import { Provider } from 'react-redux';
import fetchMock from 'fetch-mock';
import { styledMount as mount } from 'spec/helpers/theming';
import SavedQueryList from 'src/views/CRUD/data/savedquery/SavedQueryList';
import SubMenu from 'src/components/Menu/SubMenu';
import ListView from 'src/components/ListView';
import Filters from 'src/components/ListView/Filters';
import ActionsBar from 'src/components/ListView/ActionsBar';
import DeleteModal from 'src/components/DeleteModal';
import Button from 'src/components/Button';
import IndeterminateCheckbox from 'src/components/IndeterminateCheckbox';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { act } from 'react-dom/test-utils';

// store needed for withToasts(DatabaseList)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const queriesInfoEndpoint = 'glob:*/api/v1/saved_query/_info*';
const queriesEndpoint = 'glob:*/api/v1/saved_query/?*';
const queryEndpoint = 'glob:*/api/v1/saved_query/*';
const queriesRelatedEndpoint = 'glob:*/api/v1/saved_query/related/database?*';
const queriesDistinctEndpoint = 'glob:*/api/v1/saved_query/distinct/schema?*';

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

fetchMock.get(queriesInfoEndpoint, {
  permissions: ['can_write'],
});
fetchMock.get(queriesEndpoint, {
  result: mockqueries,
  count: 3,
});

fetchMock.delete(queryEndpoint, {});
fetchMock.delete(queriesEndpoint, {});

fetchMock.get(queriesRelatedEndpoint, {
  count: 0,
  result: [],
});

fetchMock.get(queriesDistinctEndpoint, {
  count: 0,
  result: [],
});

describe('SavedQueryList', () => {
  const wrapper = mount(
    <Provider store={store}>
      <SavedQueryList />
    </Provider>,
  );

  beforeAll(async () => {
    await waitForComponentToPaint(wrapper);
  });

  it('renders', () => {
    expect(wrapper.find(SavedQueryList)).toExist();
  });

  it('renders a SubMenu', () => {
    expect(wrapper.find(SubMenu)).toExist();
  });

  it('renders a ListView', () => {
    expect(wrapper.find(ListView)).toExist();
  });

  it('fetches saved queries', () => {
    const callsQ = fetchMock.calls(/saved_query\/\?q/);
    expect(callsQ).toHaveLength(1);
    expect(callsQ[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/saved_query/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25)"`,
    );
  });

  it('renders ActionsBar in table', () => {
    expect(wrapper.find(ActionsBar)).toExist();
    expect(wrapper.find(ActionsBar)).toHaveLength(3);
  });

  it('deletes', async () => {
    act(() => {
      wrapper.find('span[data-test="delete-action"]').first().props().onClick();
    });
    await waitForComponentToPaint(wrapper);

    expect(
      wrapper.find(DeleteModal).first().props().description,
    ).toMatchInlineSnapshot(
      `"This action will permanently delete the saved query."`,
    );

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

    expect(fetchMock.calls(/saved_query\/0/, 'DELETE')).toHaveLength(1);
  });

  it('shows/hides bulk actions when bulk actions is clicked', async () => {
    const button = wrapper.find(Button).at(0);
    act(() => {
      button.props().onClick();
    });
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(IndeterminateCheckbox)).toHaveLength(
      mockqueries.length + 1, // 1 for each row and 1 for select all
    );
  });

  it('searches', async () => {
    const filtersWrapper = wrapper.find(Filters);
    act(() => {
      filtersWrapper.find('[name="label"]').first().props().onSubmit('fooo');
    });
    await waitForComponentToPaint(wrapper);

    expect(fetchMock.lastCall()[0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/saved_query/?q=(filters:!((col:label,opr:all_text,value:fooo)),order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25)"`,
    );
  });
});
