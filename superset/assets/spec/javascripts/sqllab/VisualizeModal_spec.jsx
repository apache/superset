import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { Modal } from 'react-bootstrap';
import Select from 'react-select';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import $ from 'jquery';
import shortid from 'shortid';
import { queries } from './fixtures';
import { sqlLabReducer } from '../../../javascripts/SqlLab/reducers';
import * as actions from '../../../javascripts/SqlLab/actions';
import { VISUALIZE_VALIDATION_ERRORS } from '../../../javascripts/SqlLab/constants';
import VisualizeModal from '../../../javascripts/SqlLab/components/VisualizeModal';
import * as exploreUtils from '../../../javascripts/explore/exploreUtils';
import { visTypes } from '../../../javascripts/explore/stores/visTypes';

global.notify = {
  info: () => {},
  error: () => {},
};

describe('VisualizeModal', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const initialState = sqlLabReducer(undefined, {});
  const store = mockStore(initialState);
  const mockedProps = {
    show: true,
    query: queries[0],
  };
  const mockColumns = {
    ds: {
      is_date: true,
      is_dim: false,
      name: 'ds',
      type: 'STRING',
    },
    gender: {
      is_date: false,
      is_dim: true,
      name: 'gender',
      type: 'STRING',
    },
  };
  const mockEvent = {
    target: {
      value: 'mock event value',
    },
  };
  const getVisualizeModalWrapper = () => (
    shallow(<VisualizeModal {...mockedProps} />, {
      context: { store },
    }).dive());

  it('renders', () => {
    expect(React.isValidElement(<VisualizeModal />)).to.equal(true);
  });
  it('renders with props', () => {
    expect(
      React.isValidElement(<VisualizeModal {...mockedProps} />),
    ).to.equal(true);
  });
  it('renders a Modal', () => {
    const wrapper = getVisualizeModalWrapper();
    expect(wrapper.find(Modal)).to.have.length(1);
  });

  describe('getColumnFromProps', () => {
    it('should require valid query parameter in props', () => {
      const emptyQuery = {
        show: true,
        query: {},
      };
      const wrapper = shallow(<VisualizeModal {...emptyQuery} />, {
        context: { store },
      }).dive();
      expect(wrapper.state().columns).to.deep.equal({});
    });
    it('should set columns state', () => {
      const wrapper = getVisualizeModalWrapper();
      expect(wrapper.state().columns).to.deep.equal(mockColumns);
    });
    it('should not change columns state when closing Modal', () => {
      const wrapper = getVisualizeModalWrapper();
      expect(wrapper.state().columns).to.deep.equal(mockColumns);

      // first change columns state
      const newColumns = {
        ds: {
          is_date: true,
          is_dim: false,
          name: 'ds',
          type: 'STRING',
        },
        name: {
          is_date: false,
          is_dim: true,
          name: 'name',
          type: 'STRING',
        },
      };
      wrapper.instance().setState({ columns: newColumns });
      // then close Modal
      wrapper.setProps({ show: false });
      expect(wrapper.state().columns).to.deep.equal(newColumns);
    });
  });

  describe('datasourceName', () => {
    const wrapper = getVisualizeModalWrapper();
    let stub;
    beforeEach(() => {
      stub = sinon.stub(shortid, 'generate').returns('abcd');
    });
    afterEach(() => {
      stub.restore();
    });

    it('should generate data source name from query', () => {
      const sampleQuery = queries[0];
      const name = wrapper.instance().datasourceName();
      expect(name).to.equal(`${sampleQuery.user}-${sampleQuery.db}-${sampleQuery.tab}-abcd`);
    });
    it('should generate data source name with empty query', () => {
      wrapper.setProps({ query: {} });
      const name = wrapper.instance().datasourceName();
      expect(name).to.equal('undefined-abcd');
    });
  });

  describe('mergedColumns', () => {
    const wrapper = getVisualizeModalWrapper();

    it('should merge by column name', () => {
      wrapper.setState({ columns: {} });
      const mc = wrapper.instance().mergedColumns();
      expect(mc).to.deep.equal(mockColumns);
    });
    it('should not override current state', () => {
      const oldColumns = {
        ds: 1,
        gender: 2,
      };
      wrapper.setState({ columns: oldColumns });

      const mc = wrapper.instance().mergedColumns();
      expect(mc.ds).to.equal(oldColumns.ds);
      expect(mc.gender).to.equal(oldColumns.gender);
    });
  });

  describe('validate', () => {
    const wrapper = getVisualizeModalWrapper();
    let columnsStub;
    beforeEach(() => {
      columnsStub = sinon.stub(wrapper.instance(), 'mergedColumns');
    });
    afterEach(() => {
      columnsStub.restore();
    });

    it('should validate column name', () => {
      columnsStub.returns(mockColumns);
      wrapper.setState({ chartType: visTypes.dist_bar });
      wrapper.instance().validate();
      expect(wrapper.state().hints).to.have.length(0);
    });
    it('should hint invalid column name', () => {
      columnsStub.returns({
        '&': 1,
      });
      wrapper.instance().validate();
      expect(wrapper.state().hints).to.have.length.above(1);
    });
    it('should hint empty chartType', () => {
      columnsStub.returns(mockColumns);
      wrapper.setState({ chartType: null });
      wrapper.instance().validate();
      expect(wrapper.state().hints).to.have.length(1);
      expect(wrapper.state().hints[0])
        .to.have.string(VISUALIZE_VALIDATION_ERRORS.REQUIRE_CHART_TYPE);
    });
    it('should check time series', () => {
      columnsStub.returns(mockColumns);
      wrapper.setState({ chartType: visTypes.line });
      wrapper.instance().validate();
      expect(wrapper.state().hints).to.have.length(0);

      // no is_date columns
      columnsStub.returns({
        ds: {
          is_date: false,
          is_dim: false,
          name: 'ds',
          type: 'STRING',
        },
        gender: {
          is_date: false,
          is_dim: true,
          name: 'gender',
          type: 'STRING',
        },
      });
      wrapper.setState({ chartType: visTypes.line });
      wrapper.instance().validate();
      expect(wrapper.state().hints).to.have.length(1);
      expect(wrapper.state().hints[0]).to.have.string(VISUALIZE_VALIDATION_ERRORS.REQUIRE_TIME);
    });
    it('should check dimension', () => {
      // no is_dim
      columnsStub.returns({
        ds: {
          is_date: true,
          is_dim: false,
          name: 'ds',
          type: 'STRING',
        },
        gender: {
          is_date: false,
          is_dim: false,
          name: 'gender',
          type: 'STRING',
        },
      });
      wrapper.setState({ chartType: visTypes.bar });
      wrapper.instance().validate();
      expect(wrapper.state().hints).to.have.length(1);
      expect(wrapper.state().hints[0])
        .to.have.string(VISUALIZE_VALIDATION_ERRORS.REQUIRE_DIMENSION);
    });
    it('should check aggregation function', () => {
      // no agg fn
      columnsStub.returns({
        ds: {
          is_date: true,
          is_dim: false,
          name: 'ds',
          type: 'STRING',
        },
        gender: {
          is_date: false,
          is_dim: false,
          name: 'gender',
          type: 'STRING',
          agg: null,
        },
      });
      const mockCharType = {
        label: 'Aggregation Chart',
        requiresAggregationFn: true,
        controlPanelSections: [],
      };
      wrapper.setState({ chartType: mockCharType });
      wrapper.instance().validate();
      expect(wrapper.state().hints).to.have.length(1);
      expect(wrapper.state().hints[0])
        .to.have.string(VISUALIZE_VALIDATION_ERRORS.REQUIRE_AGGREGATION_FUNCTION);
    });
    it('should validate after change checkbox', () => {
      const spy = sinon.spy(wrapper.instance(), 'validate');
      columnsStub.returns(mockColumns);

      wrapper.instance().changeCheckbox('is_dim', 'gender', mockEvent);
      expect(spy.callCount).to.equal(1);
      spy.restore();
    });
    it('should validate after change Agg function', () => {
      const spy = sinon.spy(wrapper.instance(), 'validate');
      columnsStub.returns(mockColumns);
      // set agg fn
      wrapper.instance().changeAggFunction('num', { label: 'MIN(x)', value: 'min' });
      expect(wrapper.state().columns.num).to.deep.equal({ agg: 'min' });
      expect(spy.callCount).to.equal(1);
      // clear agg fn
      wrapper.instance().changeAggFunction('num');
      expect(wrapper.state().columns.num).to.deep.equal({ agg: null });
      expect(spy.callCount).to.equal(2);
      spy.restore();
    });
  });

  it('should validate after change chart type', () => {
    const wrapper = getVisualizeModalWrapper();
    wrapper.setState({ chartType: visTypes.line });
    const spy = sinon.spy(wrapper.instance(), 'validate');

    wrapper.instance().changeChartType(visTypes.bar);
    expect(spy.callCount).to.equal(1);
    expect(wrapper.state().chartType).to.equal(visTypes.bar);
  });

  it('should validate after change datasource name', () => {
    const wrapper = getVisualizeModalWrapper();
    const spy = sinon.spy(wrapper.instance(), 'validate');

    wrapper.instance().changeDatasourceName(mockEvent);
    expect(spy.callCount).to.equal(1);
    expect(wrapper.state().datasourceName).to.equal(mockEvent.target.value);
  });

  it('should build viz options', () => {
    const wrapper = getVisualizeModalWrapper();
    wrapper.setState({ chartType: visTypes.line });
    const spy = sinon.spy(wrapper.instance(), 'buildVizOptions');
    wrapper.instance().buildVizOptions();
    expect(spy.returnValues[0]).to.deep.equal({
      chartType: wrapper.state().chartType.value,
      datasourceName: wrapper.state().datasourceName,
      columns: wrapper.state().columns,
      sql: wrapper.instance().props.query.sql,
      dbId: wrapper.instance().props.query.dbId,
    });
  });

  it('should build visualize advise for long query', () => {
    const longQuery = Object.assign({}, queries[0], { endDttm: 1476910666798 });
    const props = {
      show: true,
      query: longQuery,
    };
    const longQueryWrapper = shallow(<VisualizeModal {...props} />, {
      context: { store },
    }).dive();
    const alertWrapper = shallow(longQueryWrapper.instance().buildVisualizeAdvise());
    expect(alertWrapper.hasClass('alert')).to.equal(true);
    expect(alertWrapper.text()).to.contain(
      'This query took 101 seconds to run, and the explore view times out at 45 seconds');
  });

  it('should not build visualize advise', () => {
    const wrapper = getVisualizeModalWrapper();
    expect(wrapper.instance().buildVisualizeAdvise()).to.be.a('undefined');
  });

  describe('visualize', () => {
    const wrapper = getVisualizeModalWrapper();
    const mockOptions = { attr: 'mockOptions' };
    wrapper.setState({
      chartType: visTypes.bar,
      columns: mockColumns,
      datasourceName: 'mockDatasourceName',
    });

    let ajaxSpy;
    let datasourceSpy;
    beforeEach(() => {
      ajaxSpy = sinon.spy($, 'ajax');
      sinon.stub(JSON, 'parse').callsFake(() => ({ table_id: 107 }));
      sinon.stub(exploreUtils, 'getExploreUrl').callsFake(() => ('mockURL'));
      sinon.stub(wrapper.instance(), 'buildVizOptions').callsFake(() => (mockOptions));
      sinon.spy(window, 'open');
      datasourceSpy = sinon.stub(actions, 'createDatasource');
    });
    afterEach(() => {
      ajaxSpy.restore();
      JSON.parse.restore();
      exploreUtils.getExploreUrl.restore();
      wrapper.instance().buildVizOptions.restore();
      window.open.restore();
      datasourceSpy.restore();
    });

    it('should build request', () => {
      wrapper.instance().visualize();
      expect(ajaxSpy.callCount).to.equal(1);

      const spyCall = ajaxSpy.getCall(0);
      expect(spyCall.args[0].type).to.equal('POST');
      expect(spyCall.args[0].url).to.equal('/superset/sqllab_viz/');
      expect(spyCall.args[0].data.data).to.equal(JSON.stringify(mockOptions));
    });
    it('should open new window', () => {
      datasourceSpy.callsFake(() => {
        const d = $.Deferred();
        d.resolve('done');
        return d.promise();
      });
      wrapper.setProps({ actions: { createDatasource: datasourceSpy } });

      wrapper.instance().visualize();
      expect(window.open.callCount).to.equal(1);
    });
    it('should notify error', () => {
      datasourceSpy.callsFake(() => {
        const d = $.Deferred();
        d.reject('error message');
        return d.promise();
      });
      wrapper.setProps({ actions: { createDatasource: datasourceSpy } });
      sinon.spy(notify, 'error');

      wrapper.instance().visualize();
      expect(window.open.callCount).to.equal(0);
      expect(notify.error.callCount).to.equal(1);
    });
  });

  describe('render', () => {
    it('should have 4 chart types', () => {
      const wrapper = getVisualizeModalWrapper();
      expect(wrapper.find(Modal)).to.have.length(1);

      const selectorOptions = wrapper.find(Modal).dive()
        .find(Modal.Body).dive()
        .find(Select)
        .props().options;
      expect(selectorOptions).to.have.length(4);

      const selectorOptionsValues =
        Object.keys(selectorOptions).map(key => selectorOptions[key].value);
      expect(selectorOptionsValues).to.have.same.members(['bar', 'line', 'pie', 'dist_bar']);
    });
  });
});
