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
import { MouseEvent } from 'react';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';

import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { styledMount as mount } from 'spec/helpers/theming';

import { QueryObject } from 'src/views/CRUD/types';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import { act } from 'spec/helpers/testing-library';
import { QueryState } from '@superset-ui/core';
import QueryPreviewModal from './QueryPreviewModal';

// store needed for withToasts
const mockStore = configureStore([thunk]);
const store = mockStore({});

const mockQueries: QueryObject[] = [...new Array(3)].map((_, i) => ({
  changed_on: new Date().toISOString(),
  id: i,
  slice_name: `cool chart ${i}`,
  database: {
    database_name: 'main db',
  },
  schema: 'public',
  sql: `SELECT ${i} FROM table`,
  executed_sql: `SELECT ${i} FROM table LIMIT 1000`,
  sql_tables: [
    { schema: 'foo', table: 'table' },
    { schema: 'bar', table: 'table_2' },
  ],
  status: QueryState.Success,
  tab_name: 'Main Tab',
  user: {
    first_name: 'cool',
    last_name: 'dude',
    id: 2,
    username: 'cooldude',
  },
  start_time: new Date().valueOf(),
  end_time: new Date().valueOf(),
  rows: 200,
  tmp_table_name: '',
  tracking_url: '',
}));

describe('QueryPreviewModal', () => {
  let currentIndex = 0;
  let currentQuery = mockQueries[currentIndex];
  const mockedProps = {
    onHide: jest.fn(),
    openInSqlLab: jest.fn(),
    queries: mockQueries,
    query: currentQuery,
    fetchData: jest.fn(() => {
      currentIndex += 1;
      currentQuery = mockQueries[currentIndex];
    }),
    show: true,
  };
  const wrapper = mount(<QueryPreviewModal store={store} {...mockedProps} />);

  beforeAll(async () => {
    await waitForComponentToPaint(wrapper);
  });

  it('renders a SyntaxHighlighter', () => {
    expect(wrapper.find(SyntaxHighlighter)).toBeTruthy();
  });

  it('toggles between user sql and executed sql', () => {
    expect(
      wrapper.find(SyntaxHighlighter).props().children,
    ).toMatchInlineSnapshot(`"SELECT 0 FROM table"`);

    act(() => {
      const props = wrapper
        .find('[data-test="toggle-executed-sql"]')
        .first()
        .props();

      if (typeof props.onClick === 'function') {
        props.onClick({} as MouseEvent);
      }
    });

    wrapper.update();

    expect(
      wrapper.find(SyntaxHighlighter).props().children,
    ).toMatchInlineSnapshot(`"SELECT 0 FROM table LIMIT 1000"`);
  });

  describe('Previous button', () => {
    it('disabled when query is the first in list', () => {
      expect(
        wrapper.find('[data-test="previous-query"]').first().props().disabled,
      ).toBe(true);
    });

    it('falls fetchData with previous index', () => {
      const mockedProps2 = {
        ...mockedProps,
        query: mockQueries[1],
      };
      const wrapper2 = mount(
        <QueryPreviewModal store={store} {...mockedProps2} />,
      );
      act(() => {
        const props = wrapper2
          .find('[data-test="previous-query"]')
          .first()
          .props();
        if (typeof props.onClick === 'function') {
          props.onClick({} as MouseEvent);
        }
      });

      expect(mockedProps2.fetchData).toHaveBeenCalledWith(0);
    });
  });

  describe('Next button', () => {
    it('calls fetchData with next index', () => {
      act(() => {
        const props = wrapper.find('[data-test="next-query"]').first().props();
        if (typeof props.onClick === 'function') {
          props.onClick({} as MouseEvent);
        }
      });

      expect(mockedProps.fetchData).toHaveBeenCalledWith(1);
    });

    it('disabled when query is last in list', () => {
      const mockedProps2 = {
        ...mockedProps,
        query: mockQueries[2],
      };
      const wrapper2 = mount(
        <QueryPreviewModal store={store} {...mockedProps2} />,
      );

      expect(
        wrapper2.find('[data-test="next-query"]').first().props().disabled,
      ).toBe(true);
    });
  });

  describe('Open in SQL Lab button', () => {
    it('calls openInSqlLab prop', () => {
      const props = wrapper
        .find('[data-test="open-in-sql-lab"]')
        .first()
        .props();

      if (typeof props.onClick === 'function') {
        props.onClick({} as MouseEvent);
      }

      expect(mockedProps.openInSqlLab).toHaveBeenCalled();
    });
  });
});
