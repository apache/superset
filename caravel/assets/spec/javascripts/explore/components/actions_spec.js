import { it, describe } from 'mocha';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import nock from 'nock';
import { expect, assert } from 'chai';
import sinon from 'sinon';
import shortid from 'shortid';
import * as actions from '../../../../javascripts/explorev2/actions/exploreActions';
import { initialState } from '../../../../javascripts/explorev2/stores/store';
import { exploreReducer } from '../../../../javascripts/explorev2/reducers/exploreReducer';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('ajax call for datasource metadata', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('should return a function', () => {
    expect(actions.setFormOpts(999, 'test')).to.be.function;
  });

  it('should dispatch clearAllOpts', () => {
    const dispatch = sinon.spy();
    actions.setFormOpts(null, null)(dispatch);
    assert(dispatch.withArgs(actions.clearAllOpts()).calledOnce);
  });

  it('should dispatch new opts', () => {
    nock('/caravel')
      .get('/fetch_datasource_metadata')
      .query({ datasource_id: 999, datasource_type: 'test' })
      .reply(200, {
        datasource_class: 'SqlaTable',
        time_columns: ['col'],
        time_grains: [],
        groupby_cols: [],
        metrics: [],
        filter_cols: [],
      });

    const store = mockStore(initialState);
    store.dispatch = sinon.spy();
    store.dispatch(actions.setFormOpts(999, 'test'));
    expect(store.dispatch.callCount).to.equal(5);
    expect(store.getState().timeColumnOpts).to.eql(['col']);
  });
});

describe('reducers', () => {
  it('should return new state with time column options', () => {
    const newState = exploreReducer(initialState, actions.setTimeColumnOpts(['col1', 'col2']));
    expect(newState.timeColumnOpts).to.eql(['col1', 'col2']);
  });
  it('should return new state with time grain options', () => {
    const newState = exploreReducer(initialState, actions.setTimeGrainOpts(['day', 'week']));
    expect(newState.timeGrainOpts).to.eql(['day', 'week']);
  });

  it('should return new state with groupby column options', () => {
    const newState = exploreReducer(initialState, actions.setGroupByColumnOpts(['col1', 'col2']));
    expect(newState.groupByColumnOpts).to.eql(['col1', 'col2']);
  });

  it('should return new state with metrics options', () => {
    const newState = exploreReducer(initialState, actions.setMetricsOpts(['metric1', 'metric2']));
    expect(newState.metricsOpts).to.eql(['metric1', 'metric2']);
  });

  it('should return new state with filter column options', () => {
    const newState = exploreReducer(initialState, actions.setFilterColumnOpts(['col1', 'col2']));
    expect(newState.filterColumnOpts).to.eql(['col1', 'col2']);
  });

  it('should return new state with all form data reset', () => {
    const newState = exploreReducer(initialState, actions.resetFormData());
    expect(newState.vizType).to.not.exist;
    expect(newState.timeColumn).to.not.exist;
    expect(newState.timeGrain).to.not.exist;
    expect(newState.since).to.not.exist;
    expect(newState.until).to.not.exist;
    expect(newState.groupByColumns).to.be.empty;
    expect(newState.metrics).to.be.empty;
    expect(newState.columns).to.be.empty;
    expect(newState.orderings).to.be.empty;
    expect(newState.timeStampFormat).to.not.exist;
    expect(newState.rowLimit).to.not.exist;
    expect(newState.searchBox).to.be.false;
    expect(newState.whereClause).to.be.empty;
    expect(newState.havingClause).to.be.empty;
    expect(newState.filters).to.be.empty;
  });

  it('should clear all options in store', () => {
    const newState = exploreReducer(initialState, actions.clearAllOpts());
    expect(newState.timeColumnOpts).to.be.empty;
    expect(newState.timeGrainOpts).to.be.empty;
    expect(newState.groupByColumnOpts).to.be.empty;
    expect(newState.metricsOpts).to.be.empty;
    expect(newState.filterColumnOpts).to.be.empty;
  });

  // it('should return new state with datasource class', () => {
  //   const newState = exploreReducer(initialState, actions.setDatasourceClass('SqlaTable'));
  //   expect(newState.datasourceClass).to.equal('SqlaTable');
  // });

  it('should return new state with datasource id', () => {
    const newState = exploreReducer(initialState, actions.setDatasource(1));
    expect(newState.datasourceId).to.equal(1);
  });

  it('should return new state with viz type', () => {
    const newState = exploreReducer(initialState, actions.setVizType('bar'));
    expect(newState.vizType).to.equal('bar');
  });

  it('should return new state with time column', () => {
    const newState = exploreReducer(initialState, actions.setTimeColumn('ds'));
    expect(newState.timeColumn).to.equal('ds');
  });

  it('should return new state with time grain', () => {
    const newState = exploreReducer(initialState, actions.setTimeGrain('day'));
    expect(newState.timeGrain).to.equal('day');
  });

  it('should return new state with since', () => {
    const newState = exploreReducer(initialState, actions.setSince('1 day ago'));
    expect(newState.since).to.equal('1 day ago');
  });

  it('should return new state with until', () => {
    const newState = exploreReducer(initialState, actions.setUntil('now'));
    expect(newState.until).to.equal('now');
  });

  it('should return new state with groupby columns', () => {
    const newState = exploreReducer(initialState, actions.setGroupByColumns(['col1', 'col2']));
    expect(newState.groupByColumns).to.eql(['col1', 'col2']);
  });

  it('should return new state with metrics', () => {
    const newState = exploreReducer(initialState, actions.setMetrics(['sum', 'count']));
    expect(newState.metrics).to.eql(['sum', 'count']);
  });

  it('should return new state with added column', () => {
    const newColumn = 'col';
    const newState = exploreReducer(initialState, actions.addColumn(newColumn));
    expect(newState.columns).to.deep.equal([newColumn]);
  });

  it('should return new state with removed column', () => {
    const testState = { initialState, columns: ['col1', 'col2'] };
    const remColumn = 'col1';
    const newState = exploreReducer(testState, actions.removeColumn(remColumn));
    expect(newState.columns).to.deep.equal(['col2']);
  });

  it('should return new state with added ordering', () => {
    const newOrdering = 'ord';
    const newState = exploreReducer(initialState, actions.addOrdering(newOrdering));
    expect(newState.orderings).to.deep.equal(['ord']);
  });

  it('should return new state with removed ordering', () => {
    const testState = { initialState, orderings: ['ord1', 'ord2'] };
    const remOrdering = 'ord1';
    const newState = exploreReducer(testState, actions.removeOrdering(remOrdering));
    expect(newState.orderings).to.deep.equal(['ord2']);
  });

  it('should return new state with time stamp', () => {
    const newState = exploreReducer(initialState, actions.setTimeStamp(1));
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

  it('should return new state with where clause', () => {
    const newState = exploreReducer(initialState, actions.setWhereClause('where'));
    expect(newState.whereClause).to.equal('where');
  });

  it('should return new state with having clause', () => {
    const newState = exploreReducer(initialState, actions.setHavingClause('having'));
    expect(newState.havingClause).to.equal('having');
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
