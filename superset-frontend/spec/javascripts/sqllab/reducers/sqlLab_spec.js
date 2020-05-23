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
import sqlLabReducer from 'src/SqlLab/reducers/sqlLab';
import * as actions from 'src/SqlLab/actions/sqlLab';
import { now } from 'src/modules/dates';

import { table, initialState as mockState } from '../fixtures';

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
      expect(newState.queryEditors).toHaveLength(2);
    });
    it('should remove a query editor', () => {
      expect(newState.queryEditors).toHaveLength(2);
      const action = {
        type: actions.REMOVE_QUERY_EDITOR,
        queryEditor: qe,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.queryEditors).toHaveLength(1);
    });
    it('should set q query editor active', () => {
      const addQueryEditorAction = {
        type: actions.ADD_QUERY_EDITOR,
        queryEditor: { ...initialState.queryEditors[0], id: 'abcd' },
      };
      newState = sqlLabReducer(newState, addQueryEditorAction);
      const setActiveQueryEditorAction = {
        type: actions.SET_ACTIVE_QUERY_EDITOR,
        queryEditor: defaultQueryEditor,
      };
      newState = sqlLabReducer(newState, setActiveQueryEditorAction);
      expect(newState.tabHistory[newState.tabHistory.length - 1]).toBe(
        defaultQueryEditor.id,
      );
    });
    it('should not fail while setting DB', () => {
      const dbId = 9;
      const action = {
        type: actions.QUERY_EDITOR_SETDB,
        queryEditor: qe,
        dbId,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.queryEditors[1].dbId).toBe(dbId);
    });
    it('should not fail while setting schema', () => {
      const schema = 'foo';
      const action = {
        type: actions.QUERY_EDITOR_SET_SCHEMA,
        queryEditor: qe,
        schema,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.queryEditors[1].schema).toBe(schema);
    });
    it('should not fail while setting autorun ', () => {
      const action = {
        type: actions.QUERY_EDITOR_SET_AUTORUN,
        queryEditor: qe,
      };
      newState = sqlLabReducer(newState, { ...action, autorun: false });
      expect(newState.queryEditors[1].autorun).toBe(false);
      newState = sqlLabReducer(newState, { ...action, autorun: true });
      expect(newState.queryEditors[1].autorun).toBe(true);
    });
    it('should not fail while setting title', () => {
      const title = 'a new title';
      const action = {
        type: actions.QUERY_EDITOR_SET_TITLE,
        queryEditor: qe,
        title,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.queryEditors[1].title).toBe(title);
    });
    it('should not fail while setting Sql', () => {
      const sql = 'SELECT nothing from dev_null';
      const action = {
        type: actions.QUERY_EDITOR_SET_SQL,
        queryEditor: qe,
        sql,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.queryEditors[1].sql).toBe(sql);
    });
    it('should not fail while setting queryLimit', () => {
      const queryLimit = 101;
      const action = {
        type: actions.QUERY_EDITOR_SET_QUERY_LIMIT,
        queryEditor: qe,
        queryLimit,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.queryEditors[1].queryLimit).toEqual(queryLimit);
    });
    it('should set selectedText', () => {
      const selectedText = 'TEST';
      const action = {
        type: actions.QUERY_EDITOR_SET_SELECTED_TEXT,
        queryEditor: newState.queryEditors[0],
        sql: selectedText,
      };
      expect(newState.queryEditors[0].selectedText).toBeNull();
      newState = sqlLabReducer(newState, action);
      expect(newState.queryEditors[0].selectedText).toBe(selectedText);
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
        type: actions.REMOVE_TABLE,
        table: newTable,
      };
      newState = sqlLabReducer(newState, action);
      expect(newState.tables).toHaveLength(0);
    });
  });
  describe('Run Query', () => {
    let newState;
    let query;
    beforeEach(() => {
      newState = { ...initialState };
      query = {
        id: 'abcd',
        progress: 0,
        startDttm: now(),
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
          startDttm: now(),
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
    it('should refresh queries when polling returns empty', () => {
      newState = sqlLabReducer(newState, actions.refreshQueries({}));
    });
  });
});
