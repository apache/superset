import sqlLabReducer from '../../../../src/SqlLab/reducers/sqlLab';
import * as actions from '../../../../src/SqlLab/actions/sqlLab';
import { table, initialState as mockState } from '../fixtures';

const initialState = mockState.sqlLab;

describe('sqlLabReducer', () => {
  describe('CLONE_QUERY_TO_NEW_TAB', () => {
    const testQuery = { sql: 'SELECT * FROM...', dbId: 1, id: 'flasj233' };
    let newState = {
      ...initialState,
      queries: { [testQuery.id]: testQuery },
    };
    beforeEach(() => {
      newState = sqlLabReducer(newState, actions.cloneQueryToNewTab(testQuery));
    });

    it('should have at most one more tab', () => {
      expect(newState.queryEditors).toHaveLength(2);
    });

    it('should have the same SQL as the cloned query', () => {
      expect(newState.queryEditors[1].sql).toBe(testQuery.sql);
    });

    it('should prefix the new tab title with "Copy of"', () => {
      expect(newState.queryEditors[1].title).toContain('Copy of');
    });

    it('should push the cloned tab onto tab history stack', () => {
      expect(newState.tabHistory[1]).toBe(newState.queryEditors[1].id);
    });
  });
  describe('Query editors actions', () => {
    let newState;
    let defaultQueryEditor;
    let qe;
    beforeEach(() => {
      newState = { ...initialState };
      defaultQueryEditor = newState.queryEditors[0];
      qe = Object.assign({}, defaultQueryEditor);
      newState = sqlLabReducer(newState, actions.addQueryEditor(qe));
      qe = newState.queryEditors[newState.queryEditors.length - 1];
    });
    it('should add a query editor', () => {
      expect(newState.queryEditors).toHaveLength(2);
    });
    it('should remove a query editor', () => {
      expect(newState.queryEditors).toHaveLength(2);
      newState = sqlLabReducer(newState, actions.removeQueryEditor(qe));
      expect(newState.queryEditors).toHaveLength(1);
    });
    it('should set q query editor active', () => {
      newState = sqlLabReducer(newState, actions.addQueryEditor(qe));
      newState = sqlLabReducer(newState, actions.setActiveQueryEditor(defaultQueryEditor));
      expect(newState.tabHistory[newState.tabHistory.length - 1]).toBe(defaultQueryEditor.id);
    });
    it('should not fail while setting DB', () => {
      const dbId = 9;
      newState = sqlLabReducer(newState, actions.queryEditorSetDb(qe, dbId));
      expect(newState.queryEditors[1].dbId).toBe(dbId);
    });
    it('should not fail while setting schema', () => {
      const schema = 'foo';
      newState = sqlLabReducer(newState, actions.queryEditorSetSchema(qe, schema));
      expect(newState.queryEditors[1].schema).toBe(schema);
    });
    it('should not fail while setting autorun ', () => {
      newState = sqlLabReducer(newState, actions.queryEditorSetAutorun(qe, false));
      expect(newState.queryEditors[1].autorun).toBe(false);
      newState = sqlLabReducer(newState, actions.queryEditorSetAutorun(qe, true));
      expect(newState.queryEditors[1].autorun).toBe(true);
    });
    it('should not fail while setting title', () => {
      const title = 'a new title';
      newState = sqlLabReducer(newState, actions.queryEditorSetTitle(qe, title));
      expect(newState.queryEditors[1].title).toBe(title);
    });
    it('should not fail while setting Sql', () => {
      const sql = 'SELECT nothing from dev_null';
      newState = sqlLabReducer(newState, actions.queryEditorSetSql(qe, sql));
      expect(newState.queryEditors[1].sql).toBe(sql);
    });
    it('should not fail while setting queryLimit', () => {
      const queryLimit = 101;
      newState = sqlLabReducer(newState, actions.queryEditorSetQueryLimit(qe, queryLimit));
      expect(newState.queryEditors[1].queryLimit).toEqual(queryLimit);
    });
    it('should set selectedText', () => {
      const selectedText = 'TEST';
      expect(newState.queryEditors[0].selectedText).toBeNull();
      newState = sqlLabReducer(
        newState, actions.queryEditorSetSelectedText(newState.queryEditors[0], 'TEST'));
      expect(newState.queryEditors[0].selectedText).toBe(selectedText);
    });
  });
  describe('Tables', () => {
    let newState;
    let newTable;
    beforeEach(() => {
      newTable = Object.assign({}, table);
      newState = sqlLabReducer(initialState, actions.mergeTable(newTable));
      newTable = newState.tables[0];
    });
    it('should add a table', () => {
      // Testing that beforeEach actually added the table
      expect(newState.tables).toHaveLength(1);
    });
    it('should merge the table attributes', () => {
      // Merging the extra attribute
      newTable.extra = true;
      newState = sqlLabReducer(newState, actions.mergeTable(newTable));
      expect(newState.tables).toHaveLength(1);
      expect(newState.tables[0].extra).toBe(true);
    });
    it('should expand and collapse a table', () => {
      newState = sqlLabReducer(newState, actions.collapseTable(newTable));
      expect(newState.tables[0].expanded).toBe(false);
      newState = sqlLabReducer(newState, actions.expandTable(newTable));
      expect(newState.tables[0].expanded).toBe(true);
    });
    it('should remove a table', () => {
      newState = sqlLabReducer(newState, actions.removeTable(newTable));
      expect(newState.tables).toHaveLength(0);
    });
  });
  describe('Run Query', () => {
    let newState;
    let query;
    let newQuery;
    beforeEach(() => {
      newState = { ...initialState };
      newQuery = { ...query };
    });
    it('should start a query', () => {
      newState = sqlLabReducer(newState, actions.startQuery(newQuery));
      expect(Object.keys(newState.queries)).toHaveLength(1);
    });
    it('should stop the query', () => {
      newState = sqlLabReducer(newState, actions.startQuery(newQuery));
      newState = sqlLabReducer(newState, actions.stopQuery(newQuery));
      const q = newState.queries[Object.keys(newState.queries)[0]];
      expect(q.state).toBe('stopped');
    });
    it('should remove a query', () => {
      newState = sqlLabReducer(newState, actions.startQuery(newQuery));
      newState = sqlLabReducer(newState, actions.removeQuery(newQuery));
      expect(Object.keys(newState.queries)).toHaveLength(0);
    });
    it('should refresh queries when polling returns empty', () => {
      newState = sqlLabReducer(newState, actions.refreshQueries({}));
    });
  });
});
