import * as r from '../../../javascripts/SqlLab/reducers';
import * as actions from '../../../javascripts/SqlLab/actions';
import { beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { alert, table, initialState } from './fixtures';

describe('sqlLabReducer', () => {
  describe('CLONE_QUERY_TO_NEW_TAB', () => {
    const testQuery = { sql: 'SELECT * FROM...', dbId: 1, id: 'flasj233' };
    let newState = Object.assign({}, initialState, { queries: { [testQuery.id]: testQuery } });
    newState = r.sqlLabReducer(newState, actions.cloneQueryToNewTab(testQuery));

    it('should have at most one more tab', () => {
      expect(newState.queryEditors).have.length(2);
    });

    it('should have the same SQL as the cloned query', () => {
      expect(newState.queryEditors[1].sql).to.equal(testQuery.sql);
    });

    it('should prefix the new tab title with "Copy of"', () => {
      expect(newState.queryEditors[1].title).to.include('Copy of');
    });

    it('should push the cloned tab onto tab history stack', () => {
      expect(newState.tabHistory[1]).to.eq(newState.queryEditors[1].id);
    });
  });
  describe('Alerts', () => {
    const state = Object.assign({}, initialState);
    let newState;
    it('should add one alert', () => {
      newState = r.sqlLabReducer(state, actions.addAlert(alert));
      expect(newState.alerts).to.have.lengthOf(1);
    });
    it('should remove one alert', () => {
      newState = r.sqlLabReducer(newState, actions.removeAlert(newState.alerts[0]));
      expect(newState.alerts).to.have.lengthOf(0);
    });
  });
  describe('Query editors actions', () => {
    let newState;
    let defaultQueryEditor;
    let qe;
    beforeEach(() => {
      newState = Object.assign({}, initialState);
      defaultQueryEditor = newState.queryEditors[0];
      qe = Object.assign({}, defaultQueryEditor);
      newState = r.sqlLabReducer(newState, actions.addQueryEditor(qe));
      qe = newState.queryEditors[newState.queryEditors.length - 1];
    });
    it('should add a query editor', () => {
      expect(newState.queryEditors).to.have.lengthOf(2);
    });
    it('should remove a query editor', () => {
      expect(newState.queryEditors).to.have.lengthOf(2);
      newState = r.sqlLabReducer(newState, actions.removeQueryEditor(qe));
      expect(newState.queryEditors).to.have.lengthOf(1);
    });
    it('should set q query editor active', () => {
      newState = r.sqlLabReducer(newState, actions.addQueryEditor(qe));
      newState = r.sqlLabReducer(newState, actions.setActiveQueryEditor(defaultQueryEditor));
      expect(newState.tabHistory[newState.tabHistory.length - 1]).equals(defaultQueryEditor.id);
    });
    it('should not fail while setting DB', () => {
      const dbId = 9;
      newState = r.sqlLabReducer(newState, actions.queryEditorSetDb(qe, dbId));
      expect(newState.queryEditors[1].dbId).to.equal(dbId);
    });
    it('should not fail while setting schema', () => {
      const schema = 'foo';
      newState = r.sqlLabReducer(newState, actions.queryEditorSetSchema(qe, schema));
      expect(newState.queryEditors[1].schema).to.equal(schema);
    });
    it('should not fail while setting autorun ', () => {
      newState = r.sqlLabReducer(newState, actions.queryEditorSetAutorun(qe, false));
      expect(newState.queryEditors[1].autorun).to.equal(false);
      newState = r.sqlLabReducer(newState, actions.queryEditorSetAutorun(qe, true));
      expect(newState.queryEditors[1].autorun).to.equal(true);
    });
    it('should not fail while setting title', () => {
      const title = 'a new title';
      newState = r.sqlLabReducer(newState, actions.queryEditorSetTitle(qe, title));
      expect(newState.queryEditors[1].title).to.equal(title);
    });
    it('should not fail while setting Sql', () => {
      const sql = 'SELECT nothing from dev_null';
      newState = r.sqlLabReducer(newState, actions.queryEditorSetSql(qe, sql));
      expect(newState.queryEditors[1].sql).to.equal(sql);
    });
    it('should set selectedText', () => {
      const selectedText = 'TEST';
      expect(newState.queryEditors[0].selectedText).to.equal(null);
      newState = r.sqlLabReducer(
        newState, actions.queryEditorSetSelectedText(newState.queryEditors[0], 'TEST'));
      expect(newState.queryEditors[0].selectedText).to.equal(selectedText);
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
    it('should add a table', () => {
      // Testing that beforeEach actually added the table
      expect(newState.tables).to.have.lengthOf(1);
    });
    it('should merge the table attributes', () => {
      // Merging the extra attribute
      newTable.extra = true;
      newState = r.sqlLabReducer(newState, actions.mergeTable(newTable));
      expect(newState.tables).to.have.lengthOf(1);
      expect(newState.tables[0].extra).to.equal(true);
    });
    it('should expand and collapse a table', () => {
      newState = r.sqlLabReducer(newState, actions.collapseTable(newTable));
      expect(newState.tables[0].expanded).to.equal(false);
      newState = r.sqlLabReducer(newState, actions.expandTable(newTable));
      expect(newState.tables[0].expanded).to.equal(true);
    });
    it('should remove a table', () => {
      newState = r.sqlLabReducer(newState, actions.removeTable(newTable));
      expect(newState.tables).to.have.lengthOf(0);
    });
  });
  describe('Run Query', () => {
    let newState;
    let query;
    let newQuery;
    beforeEach(() => {
      newState = Object.assign({}, initialState);
      newQuery = Object.assign({}, query);
    });
    it('should start a query', () => {
      newState = r.sqlLabReducer(newState, actions.startQuery(newQuery));
      expect(Object.keys(newState.queries)).to.have.lengthOf(1);
    });
    it('should stop the query', () => {
      newState = r.sqlLabReducer(newState, actions.startQuery(newQuery));
      newState = r.sqlLabReducer(newState, actions.stopQuery(newQuery));
      const q = newState.queries[Object.keys(newState.queries)[0]];
      expect(q.state).to.equal('stopped');
    });
    it('should remove a query', () => {
      newState = r.sqlLabReducer(newState, actions.startQuery(newQuery));
      newState = r.sqlLabReducer(newState, actions.removeQuery(newQuery));
      expect(Object.keys(newState.queries)).to.have.lengthOf(0);
    });
    it('should refresh queries when polling returns empty', () => {
      newState = r.sqlLabReducer(newState, actions.refreshQueries({}));
    });
  });
});
