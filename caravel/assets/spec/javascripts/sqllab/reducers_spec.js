import * as r from '../../../javascripts/SqlLab/reducers';
import * as actions from '../../../javascripts/SqlLab/actions';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { alert, table, initialState, query } from './common';

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
    const state = Object.assign({}, initialState);
    let newState;
    const defaultQueryEditor = state.queryEditors[0];
    const qe = Object.assign({}, defaultQueryEditor);
    qe.id = '2ed2';
    it('should add a query editor', () => {
      newState = r.sqlLabReducer(state, actions.addQueryEditor(qe));
      expect(newState.queryEditors).to.have.lengthOf(2);
    });
    it('should remove a query editor', () => {
      newState = r.sqlLabReducer(newState, actions.removeQueryEditor(qe));
      expect(newState.queryEditors).to.have.lengthOf(1);
    });
    it('should set q query editor active', () => {
      newState = r.sqlLabReducer(state, actions.addQueryEditor(qe));
      newState = r.sqlLabReducer(newState, actions.setActiveQueryEditor(defaultQueryEditor));
      expect(newState.tabHistory[newState.tabHistory.length - 1]).equals(defaultQueryEditor.id);
    });
    it('should not fail while setting attributes', () => {
      newState = r.sqlLabReducer(state, actions.queryEditorSetDb(qe, 1));
      newState = r.sqlLabReducer(state, actions.queryEditorSetSchema(qe, 'schema'));
      newState = r.sqlLabReducer(state, actions.queryEditorSetAutorun(qe, false));
      newState = r.sqlLabReducer(state, actions.queryEditorSetTitle(qe, 'title'));
      newState = r.sqlLabReducer(state, actions.queryEditorSetSql(qe, 'SELECT nothing'));
    });
  });
  describe('Tables', () => {
    const state = Object.assign({}, initialState);
    let newState;
    it('should add a table', () => {
      newState = r.sqlLabReducer(state, actions.mergeTable(table));
      expect(newState.tables).to.have.lengthOf(1);
      table.extra = true;
      newState = r.sqlLabReducer(newState, actions.mergeTable(table));
      expect(newState.tables).to.have.lengthOf(1);
      expect(newState.tables[0].extra).to.equal(true);
      newState = r.sqlLabReducer(newState, actions.collapseTable(table));
      expect(newState.tables[0].expanded).to.equal(false);
      newState = r.sqlLabReducer(newState, actions.expandTable(table));
      expect(newState.tables[0].expanded).to.equal(true);
      newState = r.sqlLabReducer(newState, actions.removeTable(table));
      expect(newState.tables).to.have.lengthOf(0);
    });
  });
  describe('Run Query', () => {
    let newState = Object.assign({}, initialState);
    it('should start', () => {
      newState = r.sqlLabReducer(newState, actions.runQuery(query));
      newState = r.sqlLabReducer(newState, actions.startQuery(query));
      expect(Object.keys(newState.queries)).to.have.lengthOf(1);
      newState = r.sqlLabReducer(newState, actions.stopQuery(query));
      newState = r.sqlLabReducer(newState, actions.removeQuery(query));
      expect(Object.keys(newState.queries)).to.have.lengthOf(0);
      newState = r.sqlLabReducer(newState, actions.refreshQueries({}));
    });
  });
});
