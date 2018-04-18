import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import { Alert, ProgressBar, Button } from 'react-bootstrap';
import FilterableTable from '../../../src/components/FilterableTable/FilterableTable';
import VisualizeModal from '../../../src/SqlLab/components/VisualizeModal';
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
    expect(React.isValidElement(<ResultSet {...mockedProps} />)).to.equal(true);
  });
  it('renders a Table', () => {
    const wrapper = shallow(<ResultSet {...mockedProps} />);
    expect(wrapper.find(FilterableTable)).to.have.length(1);
  });
  describe('getControls', () => {
    it('should render controls', () => {
      const wrapper = shallow(<ResultSet {...mockedProps} />);
      wrapper.instance().getControls();
      expect(wrapper.find(Button)).to.have.length(2);
      expect(wrapper.find('input').props().placeholder).to.equal('Search Results');
    });
    it('should handle no controls', () => {
      const wrapper = shallow(<ResultSet {...mockedProps} />);
      wrapper.setProps({ search: false, visualize: false, csv: false });
      const controls = wrapper.instance().getControls();
      expect(controls.props.className).to.equal('noControls');
    });
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

      expect(wrapper.state().data).to.deep.equal(newProps.query.results.data);
      expect(clearQuerySpy.callCount).to.equal(1);
      expect(clearQuerySpy.getCall(0).args[0]).to.deep.equal(newProps.query);
      expect(fetchQuerySpy.callCount).to.equal(1);
      expect(fetchQuerySpy.getCall(0).args[0]).to.deep.equal(newProps.query);
    });
  });
  describe('render', () => {
    it('should render success query', () => {
      const wrapper = shallow(<ResultSet {...mockedProps} />);
      const filterableTable = wrapper.find(FilterableTable);
      expect(filterableTable.props().data).to.equal(mockedProps.query.results.data);
      expect(wrapper.find(VisualizeModal)).to.have.length(1);
    });
    it('should render empty results', () => {
      const wrapper = shallow(<ResultSet {...mockedProps} />);
      const emptyResults = Object.assign({}, queries[0], {
        results: {
          data: [],
        },
      });
      wrapper.setProps({ query: emptyResults });
      expect(wrapper.find(FilterableTable)).to.have.length(0);
      expect(wrapper.find(Alert)).to.have.length(1);
      expect(wrapper.find(Alert).shallow().text()).to.equal('The query returned no data');
    });
    it('should render cached query', () => {
      const wrapper = shallow(<ResultSet {...cachedQueryProps} />);
      const cachedData = [
        { col1: 'a', col2: 'b' },
      ];
      wrapper.setState({ data: cachedData });
      const filterableTable = wrapper.find(FilterableTable);
      expect(filterableTable.props().data).to.equal(cachedData);
    });
    it('should render stopped query', () => {
      const wrapper = shallow(<ResultSet {...stoppedQueryProps} />);
      expect(wrapper.find(Alert)).to.have.length(1);
    });
    it('should render running/pending/fetching query', () => {
      const wrapper = shallow(<ResultSet {...runningQueryProps} />);
      expect(wrapper.find(ProgressBar)).to.have.length(1);
    });
  });
});
