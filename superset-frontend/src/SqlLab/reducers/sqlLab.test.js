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
import { QueryState } from '@superset-ui/core';
import sqlLabReducer from 'src/SqlLab/reducers/sqlLab';
import * as actions from 'src/SqlLab/actions/sqlLab';
import { table, initialState as mockState } from '../fixtures';
import { QUERY_UPDATE_FREQ } from '../components/QueryAutoRefresh';

const initialState = mockState.sqlLab;

describe('sqlLabReducer', () => {
  describe('Query editors actions', () => {
    let newState;
    let defaultQueryEditor;
    let qe;
    beforeEach(() => {
      newState = { ...initialState };
      defaultQueryEditor = newState.queryEditors[0];
      const action = {
        type: actions.ADD_QUERY_EDITOR,
        queryEditor: { ...initialState.queryEditors[0], id: 'abcd' },
      };
      newState = sqlLabReducer(newState, action);
      qe = newState.queryEditors.find(e => e.id === 'abcd');
    });
    it('should add a query editor', () => {
      expect(newState.queryEditors).toHaveLength(
        initialState.queryEditors.length + 1,
      );
    });
    it('should merge the current unsaved changes when adding a query editor', () => {
      const expectedTitle = 'new updated title';
      const updateAction = {
        type: actions.QUERY_EDITOR_SET_TITLE,
        queryEditor: initialState.queryEditors[0],
        name: expectedTitle,
      };
      newState = sqlLabReducer(newState, updateAction);
      const addAction = {
        type: actions.ADD_QUERY_EDITOR,
        queryEditor: { ...initialState.queryEditors[0], id: 'efgh' },
      };
      newState = sqlLabReducer(newState, addAction);

      expect(newState.queryEditors[0].name).toEqual(expectedTitle);
      expect(
        newState.queryEditors[newState.queryEditors.length - 1].id,
      ).toEqual('efgh');
    });
    it('should remove a query editor', () => {
      expect(newState.queryEditors).toHaveLength(
        initialState.queryEditors.length + 1,
      );
      const action = {
        type: actions.REMOVE_QUERY_EDITOR,
        queryEditor: qe,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.queryEditors).toHaveLength(
        initialState.queryEditors.length,
      );
    });
    it('should remove a query editor including unsaved changes', () => {
      expect(newState.queryEditors).toHaveLength(
        initialState.queryEditors.length + 1,
      );
      let action = {
        type: actions.QUERY_EDITOR_SETDB,
        queryEditor: qe,
        dbId: 123,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.unsavedQueryEditor.dbId).toEqual(action.dbId);
      action = {
        type: actions.REMOVE_QUERY_EDITOR,
        queryEditor: qe,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.queryEditors).toHaveLength(
        initialState.queryEditors.length,
      );
      expect(newState.unsavedQueryEditor.dbId).toBeUndefined();
      expect(newState.unsavedQueryEditor.id).toBeUndefined();
    });
    it('should set q query editor active', () => {
      const expectedTitle = 'new updated title';
      const addQueryEditorAction = {
        type: actions.ADD_QUERY_EDITOR,
        queryEditor: { ...initialState.queryEditors[0], id: 'abcd' },
      };
      newState = sqlLabReducer(newState, addQueryEditorAction);
      const updateAction = {
        type: actions.QUERY_EDITOR_SET_TITLE,
        queryEditor: initialState.queryEditors[1],
        name: expectedTitle,
      };
      newState = sqlLabReducer(newState, updateAction);
      const setActiveQueryEditorAction = {
        type: actions.SET_ACTIVE_QUERY_EDITOR,
        queryEditor: defaultQueryEditor,
      };
      newState = sqlLabReducer(newState, setActiveQueryEditorAction);
      expect(newState.tabHistory[newState.tabHistory.length - 1]).toBe(
        defaultQueryEditor.id,
      );
      expect(newState.queryEditors[1].name).toEqual(expectedTitle);
    });
    it('should not fail while setting DB', () => {
      const dbId = 9;
      const action = {
        type: actions.QUERY_EDITOR_SETDB,
        queryEditor: qe,
        dbId,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.unsavedQueryEditor.dbId).toBe(dbId);
      expect(newState.unsavedQueryEditor.id).toBe(qe.id);
    });
    it('should not fail while setting schema', () => {
      const schema = 'foo';
      const action = {
        type: actions.QUERY_EDITOR_SET_SCHEMA,
        queryEditor: qe,
        schema,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.unsavedQueryEditor.schema).toBe(schema);
      expect(newState.unsavedQueryEditor.id).toBe(qe.id);
    });
    it('should not fail while setting autorun', () => {
      const action = {
        type: actions.QUERY_EDITOR_SET_AUTORUN,
        queryEditor: qe,
      };
      newState = sqlLabReducer(newState, { ...action, autorun: false });
      expect(newState.unsavedQueryEditor.autorun).toBe(false);
      expect(newState.unsavedQueryEditor.id).toBe(qe.id);
      newState = sqlLabReducer(newState, { ...action, autorun: true });
      expect(newState.unsavedQueryEditor.autorun).toBe(true);
      expect(newState.unsavedQueryEditor.id).toBe(qe.id);
    });
    it('should not fail while setting title', () => {
      const title = 'Untitled Query 1';
      const action = {
        type: actions.QUERY_EDITOR_SET_TITLE,
        queryEditor: qe,
        name: title,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.unsavedQueryEditor.name).toBe(title);
      expect(newState.unsavedQueryEditor.id).toBe(qe.id);
    });
    it('should not fail while setting Sql', () => {
      const sql = 'SELECT nothing from dev_null';
      const action = {
        type: actions.QUERY_EDITOR_SET_SQL,
        queryEditor: qe,
        sql,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.unsavedQueryEditor.sql).toBe(sql);
      expect(newState.unsavedQueryEditor.id).toBe(qe.id);
    });
    it('should not fail while setting queryLimit', () => {
      const queryLimit = 101;
      const action = {
        type: actions.QUERY_EDITOR_SET_QUERY_LIMIT,
        queryEditor: qe,
        queryLimit,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.unsavedQueryEditor.queryLimit).toBe(queryLimit);
      expect(newState.unsavedQueryEditor.id).toBe(qe.id);
    });
    it('should set selectedText', () => {
      const selectedText = 'TEST';
      const action = {
        type: actions.QUERY_EDITOR_SET_SELECTED_TEXT,
        queryEditor: qe,
        sql: selectedText,
      };
      expect(qe.selectedText).toBeFalsy();
      newState = sqlLabReducer(newState, action);
      expect(newState.unsavedQueryEditor.selectedText).toBe(selectedText);
      expect(newState.unsavedQueryEditor.id).toBe(qe.id);
    });
    it('should not wiped out unsaved changes while delayed async call intercepted', () => {
      const expectedSql = 'Updated SQL WORKING IN PROGRESS--';
      const action = {
        type: actions.QUERY_EDITOR_SET_SQL,
        queryEditor: qe,
        sql: expectedSql,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.unsavedQueryEditor.sql).toBe(expectedSql);
      const interceptedAction = {
        type: actions.QUERY_EDITOR_PERSIST_HEIGHT,
        queryEditor: newState.queryEditors[0],
        northPercent: 46,
        southPercent: 54,
      };
      newState = sqlLabReducer(newState, interceptedAction);
      expect(newState.unsavedQueryEditor.sql).toBe(expectedSql);
      expect(newState.queryEditors[0].northPercent).toBe(
        interceptedAction.northPercent,
      );
    });
  });
  describe('Tables', () => {
    let newState;
    let newTable;
    beforeEach(() => {
      newTable = { ...table };
      const action = {
        type: actions.MERGE_TABLE,
        table: newTable,
      };
      newState = sqlLabReducer(initialState, action);
      newTable = newState.tables[0];
    });
    it('should add a table', () => {
      // Testing that beforeEach actually added the table
      expect(newState.tables).toHaveLength(1);
      expect(newState.tables[0].expanded).toBe(true);
    });
    it('should merge the table attributes', () => {
      // Merging the extra attribute
      newTable.extra = true;
      const action = {
        type: actions.MERGE_TABLE,
        table: newTable,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.tables).toHaveLength(1);
      expect(newState.tables[0].extra).toBe(true);
    });
    it('should overwrite table ID be ignored when the existing table is already initialized', () => {
      const action = {
        type: actions.MERGE_TABLE,
        table: newTable,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.tables).toHaveLength(1);
      // Merging the initialized remote id
      const remoteId = 1;
      const syncAction = {
        type: actions.MERGE_TABLE,
        table: {
          ...newTable,
          id: remoteId,
          initialized: true,
        },
      };
      newState = sqlLabReducer(newState, syncAction);
      expect(newState.tables).toHaveLength(1);
      expect(newState.tables[0].initialized).toBe(true);
      expect(newState.tables[0].id).toBe(remoteId);
      const overwriteAction = {
        type: actions.MERGE_TABLE,
        table: {
          id: 'rnd_new_id',
          ...newTable,
        },
      };
      newState = sqlLabReducer(newState, overwriteAction);
      expect(newState.tables).toHaveLength(1);
      expect(newState.tables[0].id).toBe(remoteId);
    });
    it('should expand and collapse a table', () => {
      const collapseTableAction = {
        type: actions.COLLAPSE_TABLE,
        table: newTable,
      };
      newState = sqlLabReducer(newState, collapseTableAction);
      expect(newState.tables[0].expanded).toBe(false);
      const expandTableAction = {
        type: actions.EXPAND_TABLE,
        table: newTable,
      };
      newState = sqlLabReducer(newState, expandTableAction);
      expect(newState.tables[0].expanded).toBe(true);
    });
    it('should remove a table', () => {
      const action = {
        type: actions.REMOVE_TABLES,
        tables: [newTable],
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.tables).toHaveLength(0);
    });
  });
  describe('Run Query', () => {
    const DENORMALIZED_CHANGED_ON = '2023-06-26T07:53:05.439';
    const CHANGED_ON_TIMESTAMP = 1687765985439;
    let newState;
    let query;
    beforeEach(() => {
      newState = { ...initialState };
      query = {
        id: 'abcd',
        progress: 0,
        changed_on: DENORMALIZED_CHANGED_ON,
        startDttm: CHANGED_ON_TIMESTAMP,
        state: 'running',
        cached: false,
        sqlEditorId: 'dfsadfs',
      };
    });
    it('should start a query', () => {
      const action = {
        type: actions.START_QUERY,
        query: {
          id: 'abcd',
          progress: 0,
          changed_on: DENORMALIZED_CHANGED_ON,
          startDttm: CHANGED_ON_TIMESTAMP,
          state: 'running',
          cached: false,
          sqlEditorId: 'dfsadfs',
        },
      };
      newState = sqlLabReducer(newState, action);
      expect(Object.keys(newState.queries)).toHaveLength(1);
    });
    it('should stop the query', () => {
      const startQueryAction = {
        type: actions.START_QUERY,
        query,
      };
      newState = sqlLabReducer(newState, startQueryAction);
      const stopQueryAction = {
        type: actions.STOP_QUERY,
        query,
      };
      newState = sqlLabReducer(newState, stopQueryAction);
      const q = newState.queries[Object.keys(newState.queries)[0]];
      expect(q.state).toBe('stopped');
    });
    it('should remove a query', () => {
      const startQueryAction = {
        type: actions.START_QUERY,
        query,
      };
      newState = sqlLabReducer(newState, startQueryAction);
      const removeQueryAction = {
        type: actions.REMOVE_QUERY,
        query,
      };
      newState = sqlLabReducer(newState, removeQueryAction);
      expect(Object.keys(newState.queries)).toHaveLength(0);
    });
    it('should refresh queries when polling returns new results', () => {
      const startDttmInStr = '1693433503447.166992';
      const endDttmInStr = '1693433503500.23132';
      newState = sqlLabReducer(
        {
          ...newState,
          queries: { abcd: {} },
        },
        actions.refreshQueries({
          abcd: {
            ...query,
            startDttm: startDttmInStr,
            endDttm: endDttmInStr,
          },
        }),
      );
      expect(newState.queries.abcd.changed_on).toBe(DENORMALIZED_CHANGED_ON);
      expect(newState.queries.abcd.startDttm).toBe(Number(startDttmInStr));
      expect(newState.queries.abcd.endDttm).toBe(Number(endDttmInStr));
      expect(newState.queriesLastUpdate).toBe(CHANGED_ON_TIMESTAMP);
    });
    it('should refresh queries when polling returns empty', () => {
      newState = sqlLabReducer(newState, actions.refreshQueries({}));
    });
  });
  describe('CLEAR_INACTIVE_QUERIES', () => {
    let newState;
    let query;
    beforeEach(() => {
      query = {
        id: 'abcd',
        changed_on: Date.now(),
        startDttm: Date.now(),
        state: QueryState.FETCHING,
        progress: 100,
        resultsKey: 'fa3dccc4-c549-4fbf-93c8-b4fb5a6fb8b7',
        cached: false,
      };
    });
    it('updates queries that have already been completed', () => {
      const current = Date.now();
      newState = sqlLabReducer(
        {
          ...newState,
          queries: {
            abcd: {
              ...query,
              results: {
                query_id: 1234,
                status: QueryState.SUCCESS,
                data: [],
              },
            },
          },
        },
        actions.clearInactiveQueries(QUERY_UPDATE_FREQ),
      );
      expect(newState.queries.abcd.state).toBe(QueryState.SUCCESS);
      expect(newState.queriesLastUpdate).toBeGreaterThanOrEqual(current);
    });
  });
});
