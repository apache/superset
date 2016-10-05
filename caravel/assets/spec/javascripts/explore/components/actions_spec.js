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

  it('should return new state with viz type', () => {
    const newState = exploreReducer(initialState, actions.setVizType('bar'));
    expect(newState.vizType).to.equal('bar');
  });

  it('should return new state with not groupby columns', () => {
    const newColumn = ['col'];
    const newState = exploreReducer(initialState, actions.setNotGroupByColumns(newColumn));
    expect(newState.columns).to.deep.equal(['col']);
  });

  it('should return new state with orderings', () => {
    const newOrdering = ['ord'];
    const newState = exploreReducer(initialState, actions.setOrderings(newOrdering));
    expect(newState.orderings).to.deep.equal(['ord']);
  });

  it('should return new state with time stamp', () => {
    const newState = exploreReducer(initialState, actions.setTimeStampFormat(1));
    expect(newState.timeStampFormat).to.equal(1);
  });

  it('should return new state with row limit', () => {
    const newState = exploreReducer(initialState, actions.setRowLimit(10));
    expect(newState.rowLimit).to.equal(10);
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
