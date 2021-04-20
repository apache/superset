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
import { Preset } from '@superset-ui/core';
import { SelectFilterPlugin, TimeFilterPlugin } from 'src/filters/components';
import { render, cleanup, screen } from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import {
  getMockStore,
  mockStore,
  stateWithoutNativeFilters,
} from 'spec/fixtures/mockStore';
import fetchMock from 'fetch-mock';
import React from 'react';
import userEvent from '@testing-library/user-event';
import { testWithId } from 'src/utils/testUtils';
import {
  FILTERS_CONFIG_MODAL_TEST_ID,
  FiltersConfigModal,
} from './FiltersConfigModal';

class MainPreset extends Preset {
  constructor() {
    super({
      name: 'Legacy charts',
      plugins: [
        new TimeFilterPlugin().configure({ key: 'filter_time' }),
        new SelectFilterPlugin().configure({ key: 'filter_select' }),
      ],
    });
  }
}

const getTestId = testWithId<string>(FILTERS_CONFIG_MODAL_TEST_ID, true);

describe('FilterConfigModal', () => {
  new MainPreset().register();
  const newFilterProps = {
    isOpen: true,
    initialFilterId: undefined,
    createNewOnOpen: true,
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };
  fetchMock.get(
    'http://localhost/api/v1/dataset/?q=(filters:!((col:table_name,opr:ct,value:%27%27)))',
    {
      count: 28,
      description_columns: {},
      ids: [
        28,
        20,
        25,
        26,
        27,
        11,
        17,
        12,
        10,
        18,
        15,
        13,
        21,
        19,
        24,
        16,
        23,
        22,
        14,
        9,
      ],
      label_columns: {
        'changed_by.first_name': 'Changed By First Name',
        'changed_by.username': 'Changed By Username',
        changed_by_name: 'Changed By Name',
        changed_by_url: 'Changed By Url',
        changed_on_delta_humanized: 'Changed On Delta Humanized',
        changed_on_utc: 'Changed On Utc',
        'database.database_name': 'Database Database Name',
        'database.id': 'Database Id',
        default_endpoint: 'Default Endpoint',
        explore_url: 'Explore Url',
        extra: 'Extra',
        id: 'Id',
        kind: 'Kind',
        'owners.first_name': 'Owners First Name',
        'owners.id': 'Owners Id',
        'owners.last_name': 'Owners Last Name',
        'owners.username': 'Owners Username',
        schema: 'Schema',
        sql: 'Sql',
        table_name: 'Table Name',
      },
      list_columns: [
        'id',
        'database.id',
        'database.database_name',
        'changed_by_name',
        'changed_by_url',
        'changed_by.first_name',
        'changed_by.username',
        'changed_on_utc',
        'changed_on_delta_humanized',
        'default_endpoint',
        'explore_url',
        'extra',
        'kind',
        'owners.id',
        'owners.username',
        'owners.first_name',
        'owners.last_name',
        'schema',
        'sql',
        'table_name',
      ],
      list_title: 'List Sqla Table',
      order_columns: [
        'table_name',
        'schema',
        'changed_by.first_name',
        'changed_on_delta_humanized',
        'database.database_name',
      ],
      result: [
        {
          changed_by: {
            first_name: 'Superset',
            username: 'admin',
          },
          changed_by_name: 'Superset Admin',
          changed_by_url: '/superset/profile/admin',
          changed_on_delta_humanized: '21 hours ago',
          changed_on_utc: '2021-04-18T11:29:39.943485+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/28/',
          extra: null,
          id: 28,
          kind: 'virtual',
          owners: [
            {
              first_name: 'Superset',
              id: 1,
              last_name: 'Admin',
              username: 'admin',
            },
          ],
          schema: 'public',
          sql:
            "-- Note: Unless you save your query, these tabs will NOT persist if you clear your cookies or change browsers.\n\nSELECT *\nFROM wb_health_population\nwhere country_code = '{{ url_param('test')}}'",
          table_name: 'test 1',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:45.676220+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/20/',
          extra: null,
          id: 20,
          kind: 'physical',
          owners: [],
          schema: null,
          sql: null,
          table_name: 'messages',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:47.144533+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/25/',
          extra: null,
          id: 25,
          kind: 'physical',
          owners: [],
          schema: null,
          sql: null,
          table_name: 'channels',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:47.387247+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/26/',
          extra: null,
          id: 26,
          kind: 'physical',
          owners: [],
          schema: null,
          sql: null,
          table_name: 'channel_members',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:47.446846+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/27/',
          extra: null,
          id: 27,
          kind: 'physical',
          owners: [],
          schema: null,
          sql: '',
          table_name: 'FCC 2018 Survey',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '7 days ago',
          changed_on_utc: '2021-04-12T07:52:17.036117+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/11/',
          extra: null,
          id: 11,
          kind: 'physical',
          owners: [],
          schema: null,
          sql: null,
          table_name: 'bart_lines',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:45.149620+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/17/',
          extra: null,
          id: 17,
          kind: 'physical',
          owners: [],
          schema: null,
          sql: null,
          table_name: 'threads',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:44.104398+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/12/',
          extra: null,
          id: 12,
          kind: 'physical',
          owners: [],
          schema: null,
          sql: '',
          table_name: 'video_game_sales',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '7 days ago',
          changed_on_utc: '2021-04-12T07:52:14.976397+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/10/',
          extra: null,
          id: 10,
          kind: 'physical',
          owners: [],
          schema: null,
          sql: null,
          table_name: 'flights',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:45.357788+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/18/',
          extra: null,
          id: 18,
          kind: 'virtual',
          owners: [],
          schema: null,
          sql:
            'SELECT date, total_membership - lag(total_membership) OVER (ORDER BY date) AS new_members FROM exported_stats',
          table_name: 'new_members_daily',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:44.734367+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/15/',
          extra: null,
          id: 15,
          kind: 'physical',
          owners: [],
          schema: null,
          sql: null,
          table_name: 'users',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:44.475830+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/13/',
          extra: null,
          id: 13,
          kind: 'physical',
          owners: [],
          schema: null,
          sql: null,
          table_name: 'users_channels',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:46.342472+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/21/',
          extra: null,
          id: 21,
          kind: 'virtual',
          owners: [],
          schema: null,
          sql:
            'SELECT c.name AS channel_name, u.name AS member_name FROM channel_members cm JOIN channels c ON cm.channel_id = c.id JOIN users u ON cm.user_id = u.id',
          table_name: 'members_channels_2',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:45.459893+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/19/',
          extra: null,
          id: 19,
          kind: 'virtual',
          owners: [],
          schema: null,
          sql:
            'SELECT m.ts, c.name, m.text FROM messages m JOIN channels c ON m.channel_id = c.id',
          table_name: 'messages_channels',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:46.869592+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/24/',
          extra: null,
          id: 24,
          kind: 'physical',
          owners: [],
          schema: null,
          sql: null,
          table_name: 'cleaned_sales_data',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:45.000456+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/16/',
          extra: null,
          id: 16,
          kind: 'physical',
          owners: [],
          schema: null,
          sql: null,
          table_name: 'unicode_test',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:46.711877+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/23/',
          extra: null,
          id: 23,
          kind: 'physical',
          owners: [],
          schema: null,
          sql: '',
          table_name: 'covid_vaccines',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:46.450461+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/22/',
          extra: null,
          id: 22,
          kind: 'physical',
          owners: [],
          schema: null,
          sql: '',
          table_name: 'exported_stats',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '4 minutes ago',
          changed_on_utc: '2021-04-19T08:42:44.581996+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/14/',
          extra: null,
          id: 14,
          kind: 'virtual',
          owners: [],
          schema: null,
          sql:
            'SELECT uc1.name as channel_1, uc2.name as channel_2, count(*) AS cnt FROM users_channels uc1 JOIN users_channels uc2 ON uc1.user_id = uc2.user_id GROUP BY uc1.name, uc2.name HAVING uc1.name <> uc2.name',
          table_name: 'users_channels-uzooNNtSRO',
        },
        {
          changed_by: null,
          changed_by_name: '',
          changed_by_url: '',
          changed_on_delta_humanized: '7 days ago',
          changed_on_utc: '2021-04-12T07:51:39.439928+0000',
          database: {
            database_name: 'examples',
            id: 1,
          },
          default_endpoint: null,
          explore_url: '/superset/explore/table/9/',
          extra: null,
          id: 9,
          kind: 'physical',
          owners: [],
          schema: null,
          sql: null,
          table_name: 'sf_population_polygons',
        },
      ],
    },
    { overwriteRoutes: true },
  );

  const renderWrapper = (
    props = newFilterProps,
    state: object = stateWithoutNativeFilters,
  ) =>
    render(
      <Provider
        store={state ? getMockStore(stateWithoutNativeFilters) : mockStore}
      >
        <FiltersConfigModal {...props} />
      </Provider>,
    );

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('Create Select Filter (with datasource and columns)', () => {
    renderWrapper();

    const FILTER_NAME = 'Select Filter 1';

    userEvent.type(screen.getByTestId(getTestId('name-input')), FILTER_NAME);
    userEvent.click(screen.getByTestId(getTestId('datasource-input')));
    screen.debug();
  });
});
