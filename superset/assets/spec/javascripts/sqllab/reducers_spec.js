import * as r from '../../../src/SqlLab/reducers';
import * as actions from '../../../src/SqlLab/actions';
import { table, initialState as mockState } from './fixtures';

const initialState = mockState.sqlLab;

describe('sqlLabReducer', () => {
  describe('CLONE_QUERY_TO_NEW_TAB', () => {
    const testQuery = { sql: 'SELECT * FROM...', dbId: 1, id: 'flasj233' };
    let newState = {
      ...initialState,
      queries: { [testQuery.id]: testQuery },
    };
    beforeEach(() => {
      newState = r.sqlLabReducer(newState, actions.cloneQueryToNewTab(testQuery));
    });

    test('should have at most one more tab', () => {
      expect(newState.queryEditors).toHaveLength(2);
    });

    test('should have the same SQL as the cloned query', () => {
      expect(newState.queryEditors[1].sql).toBe(testQuery.sql);
    });

    test('should prefix the new tab title with "Copy of"', () => {
      expect(newState.queryEditors[1].title).toContain('Copy of');
    });

    test('should push the cloned tab onto tab history stack', () => {
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
      newState = r.sqlLabReducer(newState, actions.addQueryEditor(qe));
      qe = newState.queryEditors[newState.queryEditors.length - 1];
    });
    test('should add a query editor', () => {
      expect(newState.queryEditors).toHaveLength(2);
    });
    test('should remove a query editor', () => {
      expect(newState.queryEditors).toHaveLength(2);
      newState = r.sqlLabReducer(newState, actions.removeQueryEditor(qe));
      expect(newState.queryEditors).toHaveLength(1);
    });
    test('should set q query editor active', () => {
      newState = r.sqlLabReducer(newState, actions.addQueryEditor(qe));
      newState = r.sqlLabReducer(newState, actions.setActiveQueryEditor(defaultQueryEditor));
      expect(newState.tabHistory[newState.tabHistory.length - 1]).toBe(defaultQueryEditor.id);
    });
    test('should not fail while setting DB', () => {
      const dbId = 9;
      newState = r.sqlLabReducer(newState, actions.queryEditorSetDb(qe, dbId));
      expect(newState.queryEditors[1].dbId).toBe(dbId);
    });
    test('should not fail while setting schema', () => {
      const schema = 'foo';
      newState = r.sqlLabReducer(newState, actions.queryEditorSetSchema(qe, schema));
      expect(newState.queryEditors[1].schema).toBe(schema);
    });
    test('should not fail while setting autorun ', () => {
      newState = r.sqlLabReducer(newState, actions.queryEditorSetAutorun(qe, false));
      expect(newState.queryEditors[1].autorun).toBe(false);
      newState = r.sqlLabReducer(newState, actions.queryEditorSetAutorun(qe, true));
      expect(newState.queryEditors[1].autorun).toBe(true);
    });
    test('should not fail while setting title', () => {
      const title = 'a new title';
      newState = r.sqlLabReducer(newState, actions.queryEditorSetTitle(qe, title));
      expect(newState.queryEditors[1].title).toBe(title);
    });
    test('should not fail while setting Sql', () => {
      const sql = 'SELECT nothing from dev_null';
      newState = r.sqlLabReducer(newState, actions.queryEditorSetSql(qe, sql));
      expect(newState.queryEditors[1].sql).toBe(sql);
    });
    test('should set selectedText', () => {
      const selectedText = 'TEST';
      expect(newState.queryEditors[0].selectedText).toBeNull();
      newState = r.sqlLabReducer(
        newState, actions.queryEditorSetSelectedText(newState.queryEditors[0], 'TEST'));
      expect(newState.queryEditors[0].selectedText).toBe(selectedText);
    });
  });
  describe('Tables', () => {
    let newState;
    let newTable;
    beforeEach(() => {
      newTable = Object.assign({}, table);
      newState = r.sqlLabReducer(initialState, actions.mergeTable(newTable));
      newTable = newState.tables[0];
    });
    test('should add a table', () => {
      // Testing that beforeEach actually added the table
      expect(newState.tables).toHaveLength(1);
    });
    test('should merge the table attributes', () => {
      // Merging the extra attribute
      newTable.extra = true;
      newState = r.sqlLabReducer(newState, actions.mergeTable(newTable));
      expect(newState.tables).toHaveLength(1);
      expect(newState.tables[0].extra).toBe(true);
    });
    test('should expand and collapse a table', () => {
      newState = r.sqlLabReducer(newState, actions.collapseTable(newTable));
      expect(newState.tables[0].expanded).toBe(false);
      newState = r.sqlLabReducer(newState, actions.expandTable(newTable));
      expect(newState.tables[0].expanded).toBe(true);
    });
    test('should remove a table', () => {
      newState = r.sqlLabReducer(newState, actions.removeTable(newTable));
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
    test('should start a query', () => {
      newState = r.sqlLabReducer(newState, actions.startQuery(newQuery));
      expect(Object.keys(newState.queries)).toHaveLength(1);
    });
    test('should stop the query', () => {
      newState = r.sqlLabReducer(newState, actions.startQuery(newQuery));
      newState = r.sqlLabReducer(newState, actions.stopQuery(newQuery));
      const q = newState.queries[Object.keys(newState.queries)[0]];
      expect(q.state).toBe('stopped');
    });
    test('should remove a query', () => {
      newState = r.sqlLabReducer(newState, actions.startQuery(newQuery));
      newState = r.sqlLabReducer(newState, actions.removeQuery(newQuery));
      expect(Object.keys(newState.queries)).toHaveLength(0);
    });
    test('should refresh queries when polling returns empty', () => {
      newState = r.sqlLabReducer(newState, actions.refreshQueries({}));
    });
  });
});
