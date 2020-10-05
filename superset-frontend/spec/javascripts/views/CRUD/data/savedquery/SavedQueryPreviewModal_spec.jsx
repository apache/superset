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
import fetchMock from 'fetch-mock';
import { styledMount as mount } from 'spec/helpers/theming';
import SavedQueryPreviewModal from 'src/views/CRUD/data/savedquery/SavedQueryPreviewModal';
import Button from 'src/components/Button';
import Modal from 'src/common/components/Modal';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { act } from 'react-dom/test-utils';

// store needed for withToasts(DatabaseList)
const mockStore = configureStore([thunk]);
const store = mockStore({});

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

const mockedProps = {
  fetchData: jest.fn(() => {}),
  openInSqlLab: jest.fn(() => {}),
  onHide: () => {},
  queries: mockqueries,
  savedQuery: mockqueries[1],
  show: true,
};

const FETCH_SAVED_QUERY_ENDPOINT = 'glob:*/api/v1/saved_query/*';
const SAVED_QUERY_PAYLOAD = { result: mockqueries[1] };

fetchMock.get(FETCH_SAVED_QUERY_ENDPOINT, SAVED_QUERY_PAYLOAD);

async function mountAndWait(props = mockedProps) {
  const mounted = mount(<SavedQueryPreviewModal {...props} />, {
    context: { store },
  });
  await waitForComponentToPaint(mounted);

  return mounted;
}

describe('SavedQueryPreviewModal', () => {
  let wrapper;

  beforeAll(async () => {
    wrapper = await mountAndWait();
  });

  it('renders', () => {
    expect(wrapper.find(SavedQueryPreviewModal)).toExist();
  });

  it('renders a Modal', () => {
    expect(wrapper.find(Modal)).toExist();
  });

  it('renders sql from saved query', () => {
    expect(wrapper.find('pre').text()).toEqual('SELECT 1 FROM table');
  });

  it('renders buttons with correct text', () => {
    expect(wrapper.find(Button).contains('Previous')).toBe(true);
    expect(wrapper.find(Button).contains('Next')).toBe(true);
    expect(wrapper.find(Button).contains('Open in SQL Lab')).toBe(true);
  });

  it('handle next save query', () => {
    const button = wrapper.find('button[data-test="next-saved-query"]');
    expect(button.props().disabled).toBe(false);
    act(() => {
      button.props().onClick(false);
    });
    expect(mockedProps.fetchData).toHaveBeenCalled();
    expect(mockedProps.fetchData.mock.calls[0][0]).toEqual(2);
  });

  it('handle previous save query', () => {
    const button = wrapper
      .find('[data-test="previous-saved-query"]')
      .find(Button);
    expect(button.props().disabled).toBe(false);
    act(() => {
      button.props().onClick(true);
    });
    wrapper.update();
    expect(mockedProps.fetchData).toHaveBeenCalled();
    expect(mockedProps.fetchData.mock.calls[0][0]).toEqual(2);
  });

  it('handle open in sql lab', async () => {
    act(() => {
      wrapper.find('[data-test="open-in-sql-lab"]').first().props().onClick();
    });
    expect(mockedProps.openInSqlLab).toHaveBeenCalled();
    expect(mockedProps.openInSqlLab.mock.calls[0][0]).toEqual(1);
  });
});
