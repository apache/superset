import { it, describe } from 'mocha';
import { expect } from 'chai';
import shortid from 'shortid';
import * as actions from '../../../../javascripts/explorev2/actions/exploreActions';
import { initialState } from '../../../../javascripts/explorev2/stores/store';
import { exploreReducer } from '../../../../javascripts/explorev2/reducers/exploreReducer';

describe('reducers', () => {
  it('should return new state with datasource id', () => {
    const newState = exploreReducer(initialState, actions.setDatasource(1));
    expect(newState.datasourceId).to.equal(1);
  });

  it('should return new state with search box toggled', () => {
    const newState = exploreReducer(initialState, actions.toggleSearchBox(true));
    expect(newState.searchBox).to.equal(true);
  });

  it('should return new state with added filter', () => {
    const newFilter = {
      id: shortid.generate(),
      eq: 'value',
      op: 'in',
      col: 'vals',
    };
    const newState = exploreReducer(initialState, actions.addFilter(newFilter));
    expect(newState.filters).to.deep.equal([newFilter]);
  });

  it('should return new state with removed filter', () => {
    const filter1 = {
      id: shortid.generate(),
      eq: 'value',
      op: 'in',
      col: 'vals1',
    };
    const filter2 = {
      id: shortid.generate(),
      eq: 'value',
      op: 'not in',
      col: 'vals2',
    };
    const testState = {
      initialState,
      filters: [filter1, filter2],
    };
    const newState = exploreReducer(testState, actions.removeFilter(filter1));
    expect(newState.filters).to.deep.equal([filter2]);
  });
});
