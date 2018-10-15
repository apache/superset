import React from 'react';
import { shallow } from 'enzyme';
import sinon from 'sinon';

import { Alert, ProgressBar } from 'react-bootstrap';
import FilterableTable from '../../../src/components/FilterableTable/FilterableTable';
import ExploreResultsButton from '../../../src/SqlLab/components/ExploreResultsButton';
import ResultSet from '../../../src/SqlLab/components/ResultSet';
import { queries, stoppedQuery, runningQuery, cachedQuery } from './fixtures';

describe('ResultSet', () => {
  const clearQuerySpy = sinon.spy();
  const fetchQuerySpy = sinon.spy();
  const mockedProps = {
    actions: {
      clearQueryResults: clearQuerySpy,
      fetchQueryResults: fetchQuerySpy,
    },
    cache: true,
    query: queries[0],
    height: 0,
  };
  const stoppedQueryProps = Object.assign({}, mockedProps, {
    query: stoppedQuery,
  });
  const runningQueryProps = Object.assign({}, mockedProps, {
    query: runningQuery,
  });
  const cachedQueryProps = Object.assign({}, mockedProps, {
    query: cachedQuery,
  });
  const newProps = {
    query: {
      cached: false,
      resultsKey: 'new key',
      results: {
        data: [{ a: 1 }],
      },
    },
  };

  it('is valid', () => {
    expect(React.isValidElement(<ResultSet {...mockedProps} />)).toBe(true);
  });
  it('renders a Table', () => {
    const wrapper = shallow(<ResultSet {...mockedProps} />);
    expect(wrapper.find(FilterableTable)).toHaveLength(1);
  });
  describe('componentWillReceiveProps', () => {
    const wrapper = shallow(<ResultSet {...mockedProps} />);
    let spy;
    beforeEach(() => {
      clearQuerySpy.reset();
      fetchQuerySpy.reset();
      spy = sinon.spy(ResultSet.prototype, 'componentWillReceiveProps');
    });
    afterEach(() => {
      spy.restore();
    });
    it('should update cached data', () => {
      wrapper.setProps(newProps);

      expect(wrapper.state().data).toEqual(newProps.query.results.data);
      expect(clearQuerySpy.callCount).toBe(1);
      expect(clearQuerySpy.getCall(0).args[0]).toEqual(newProps.query);
      expect(fetchQuerySpy.callCount).toBe(1);
      expect(fetchQuerySpy.getCall(0).args[0]).toEqual(newProps.query);
    });
  });
  describe('render', () => {
    it('should render success query', () => {
      const wrapper = shallow(<ResultSet {...mockedProps} />);
      const filterableTable = wrapper.find(FilterableTable);
      expect(filterableTable.props().data).toBe(mockedProps.query.results.data);
      expect(wrapper.find(ExploreResultsButton)).toHaveLength(1);
    });
    it('should render empty results', () => {
      const wrapper = shallow(<ResultSet {...mockedProps} />);
      const emptyResults = Object.assign({}, queries[0], {
        results: {
          data: [],
        },
      });
      wrapper.setProps({ query: emptyResults });
      expect(wrapper.find(FilterableTable)).toHaveLength(0);
      expect(wrapper.find(Alert)).toHaveLength(1);
      expect(wrapper.find(Alert).shallow().text()).toBe('The query returned no data');
    });
    it('should render cached query', () => {
      const wrapper = shallow(<ResultSet {...cachedQueryProps} />);
      const cachedData = [
        { col1: 'a', col2: 'b' },
      ];
      wrapper.setState({ data: cachedData });
      const filterableTable = wrapper.find(FilterableTable);
      expect(filterableTable.props().data).toBe(cachedData);
    });
    it('should render stopped query', () => {
      const wrapper = shallow(<ResultSet {...stoppedQueryProps} />);
      expect(wrapper.find(Alert)).toHaveLength(1);
    });
    it('should render running/pending/fetching query', () => {
      const wrapper = shallow(<ResultSet {...runningQueryProps} />);
      expect(wrapper.find(ProgressBar)).toHaveLength(1);
    });
  });
});
