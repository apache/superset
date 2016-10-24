import * as r from '../../../javascripts/SqlLab/reducers';
import * as actions from '../../../javascripts/SqlLab/actions';
import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('sqlLabReducer', () => {
  describe('CLONE_QUERY_TO_NEW_TAB', () => {
    const testQuery = { sql: 'SELECT * FROM...', dbId: 1, id: 1 };
    const state = Object.assign(r.initialState, { queries: [testQuery] });
    const newState = r.sqlLabReducer(state, actions.cloneQueryToNewTab(testQuery));

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
});
