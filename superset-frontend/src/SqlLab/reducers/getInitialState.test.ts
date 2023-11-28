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

import { DEFAULT_COMMON_BOOTSTRAP_DATA } from 'src/constants';
import { runningQuery, successfulQuery } from 'src/SqlLab/fixtures';
import getInitialState, { dedupeTabHistory } from './getInitialState';

const apiData = {
  common: DEFAULT_COMMON_BOOTSTRAP_DATA,
  tab_state_ids: [],
  databases: [],
  queries: {},
  user: {
    userId: 1,
    username: 'some name',
    isActive: true,
    isAnonymous: false,
    firstName: 'first name',
    lastName: 'last name',
    permissions: {},
    roles: {},
  },
};
const apiDataWithTabState = {
  ...apiData,
  tab_state_ids: [{ id: 1, label: 'test' }],
  active_tab: {
    id: 1,
    user_id: 1,
    label: 'editor1',
    active: true,
    database_id: 1,
    sql: '',
    table_schemas: [],
    saved_query: null,
    template_params: null,
    latest_query: null,
  },
};
describe('getInitialState', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('should output the user that is passed in', () => {
    expect(getInitialState(apiData).user?.userId).toEqual(1);
  });
  it('should return undefined instead of null for templateParams', () => {
    expect(
      getInitialState(apiDataWithTabState).sqlLab?.queryEditors?.[0]
        ?.templateParams,
    ).toBeUndefined();
  });

  describe('dedupeTabHistory', () => {
    it('should dedupe the tab history', () => {
      [
        { value: [], expected: [] },
        {
          value: ['12', '3', '4', '5', '6'],
          expected: ['12', '3', '4', '5', '6'],
        },
        {
          value: [
            '1',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
          ],
          expected: ['1', '2'],
        },
        {
          value: [
            '1',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '3',
          ],
          expected: ['1', '2', '3'],
        },
        {
          value: [
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '2',
            '3',
          ],
          expected: ['2', '3'],
        },
      ].forEach(({ value, expected }) => {
        expect(dedupeTabHistory(value)).toEqual(expected);
      });
    });
  });

  describe('dedupe tables schema', () => {
    it('should dedupe the table schema', () => {
      localStorage.setItem(
        'redux',
        JSON.stringify({
          sqlLab: {
            tables: [
              { id: 1, name: 'test1' },
              { id: 6, name: 'test6' },
            ],
            queryEditors: [{ id: 1, title: 'editor1' }],
            queries: {},
            tabHistory: [],
          },
        }),
      );
      const initializedTables = getInitialState({
        ...apiData,
        active_tab: {
          id: 1,
          user_id: 1,
          label: 'editor1',
          active: true,
          database_id: 1,
          sql: '',
          table_schemas: [
            {
              id: 1,
              table: 'table1',
              tab_state_id: 1,
              description: {
                columns: [
                  { name: 'id', type: 'INT' },
                  { name: 'column2', type: 'STRING' },
                ],
              },
            },
            {
              id: 2,
              table: 'table2',
              tab_state_id: 1,
              description: {
                columns: [
                  { name: 'id', type: 'INT' },
                  { name: 'column2', type: 'STRING' },
                ],
              },
            },
          ],
          saved_query: null,
          template_params: null,
          latest_query: null,
        },
      }).sqlLab.tables;
      expect(initializedTables.map(({ id }) => id)).toEqual([1, 2, 6]);
    });

    it('should parse the float dttm value', () => {
      const startDttmInStr = '1693433503447.166992';
      const endDttmInStr = '1693433503500.23132';

      localStorage.setItem(
        'redux',
        JSON.stringify({
          sqlLab: {
            tables: [
              { id: 1, name: 'test1' },
              { id: 6, name: 'test6' },
            ],
            queryEditors: [{ id: 1, title: 'editor1' }],
            queries: {
              localStoragePersisted: {
                ...successfulQuery,
                id: 'localStoragePersisted',
                startDttm: startDttmInStr,
                endDttm: endDttmInStr,
              },
            },
            tabHistory: [],
          },
        }),
      );

      const initializedQueries = getInitialState({
        ...apiData,
        queries: {
          backendPersisted: {
            ...runningQuery,
            id: 'backendPersisted',
            startDttm: startDttmInStr,
            endDttm: endDttmInStr,
          },
        },
      }).sqlLab.queries;
      expect(initializedQueries.backendPersisted).toEqual(
        expect.objectContaining({
          startDttm: Number(startDttmInStr),
          endDttm: Number(endDttmInStr),
        }),
      );
      expect(initializedQueries.localStoragePersisted).toEqual(
        expect.objectContaining({
          startDttm: Number(startDttmInStr),
          endDttm: Number(endDttmInStr),
        }),
      );
    });
  });

  describe('restore unsaved changes for PERSISTENCE mode', () => {
    const lastUpdatedTime = Date.now();
    const expectedValue = 'updated editor value';
    beforeEach(() => {
      localStorage.setItem(
        'redux',
        JSON.stringify({
          sqlLab: {
            queryEditors: [
              {
                // restore cached value since updates are after server update time
                id: '1',
                name: expectedValue,
                updatedAt: lastUpdatedTime + 100,
              },
              {
                // no update required given that last updated time comes before server update time
                id: '2',
                name: expectedValue,
                updatedAt: lastUpdatedTime - 100,
              },
              {
                // no update required given that there's no updatedAt
                id: '3',
                name: expectedValue,
              },
            ],
          },
        }),
      );
    });

    it('restore unsaved changes for PERSISTENCE mode', () => {
      const apiDataWithLocalStorage = {
        ...apiData,
        active_tab: {
          ...apiDataWithTabState.active_tab,
          id: 1,
          label: 'persisted tab',
          table_schemas: [],
          extra_json: {
            updatedAt: lastUpdatedTime,
          },
        },
        tab_state_ids: [{ id: 1, label: '' }],
      };
      expect(
        getInitialState(apiDataWithLocalStorage).sqlLab.queryEditors[0],
      ).toEqual(
        expect.objectContaining({
          id: '1',
          name: expectedValue,
        }),
      );
    });

    it('skip unsaved changes for expired data', () => {
      const apiDataWithLocalStorage = {
        ...apiData,
        active_tab: {
          ...apiDataWithTabState.active_tab,
          id: 2,
          label: 'persisted tab',
          table_schemas: [],
          extra_json: {
            updatedAt: lastUpdatedTime,
          },
        },
        tab_state_ids: [{ id: 2, label: '' }],
      };
      expect(
        getInitialState(apiDataWithLocalStorage).sqlLab.queryEditors[1],
      ).toEqual(
        expect.objectContaining({
          id: '2',
          name: apiDataWithLocalStorage.active_tab.label,
        }),
      );
    });

    it('skip unsaved changes for legacy cache data', () => {
      const apiDataWithLocalStorage = {
        ...apiData,
        active_tab: {
          ...apiDataWithTabState.active_tab,
          id: 3,
          label: 'persisted tab',
          table_schemas: [],
          extra_json: {
            updatedAt: lastUpdatedTime,
          },
        },
        tab_state_ids: [{ id: 3, label: '' }],
      };
      expect(
        getInitialState(apiDataWithLocalStorage).sqlLab.queryEditors[2],
      ).toEqual(
        expect.objectContaining({
          id: '3',
          name: apiDataWithLocalStorage.active_tab.label,
        }),
      );
    });
  });
});
