import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { Modal } from 'react-bootstrap';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import $ from 'jquery';
import shortid from 'shortid';
import { queries } from './fixtures';
import { sqlLabReducer } from '../../../src/SqlLab/reducers';
import * as actions from '../../../src/SqlLab/actions';
import { VISUALIZE_VALIDATION_ERRORS } from '../../../src/SqlLab/constants';
import VisualizeModal from '../../../src/SqlLab/components/VisualizeModal';
import * as exploreUtils from '../../../src/explore/exploreUtils';

describe('VisualizeModal', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const initialState = {
    sqlLab: {
      ...sqlLabReducer(undefined, {}),
      common: {
        conf: { SUPERSET_WEBSERVER_TIMEOUT: 45 },
      },
    },
  };
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
  const mockChartTypeBarChart = {
    label: 'Distribution - Bar Chart',
    requiresTime: false,
    value: 'dist_bar',
  };
  const mockChartTypeTB = {
    label: 'Time Series - Bar Chart',
    requiresTime: true,
    value: 'bar',
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
    const oldColumns = {
      ds: 1,
      gender: 2,
    };

    it('should merge by column name', () => {
      wrapper.setState({ columns: {} });
      const mc = wrapper.instance().mergedColumns();
      expect(mc).to.deep.equal(mockColumns);
    });
    it('should not override current state', () => {
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
      wrapper.instance().validate();
      expect(wrapper.state().hints).to.have.length(0);
      wrapper.instance().mergedColumns.restore();
    });
    it('should hint invalid column name', () => {
      columnsStub.returns({
        '&': 1,
      });
      wrapper.instance().validate();
      expect(wrapper.state().hints).to.have.length(1);
      wrapper.instance().mergedColumns.restore();
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
      wrapper.setState({ chartType: mockChartTypeTB });
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
      wrapper.setState({ chartType: mockChartTypeTB });
      wrapper.instance().validate();
      expect(wrapper.state().hints).to.have.length(1);
      expect(wrapper.state().hints[0]).to.have.string(VISUALIZE_VALIDATION_ERRORS.REQUIRE_TIME);
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

      wrapper.instance().changeAggFunction('num', { label: 'MIN(x)', value: 'min' });
      expect(spy.callCount).to.equal(1);
      spy.restore();
    });
  });

  it('should validate after change chart type', () => {
    const wrapper = getVisualizeModalWrapper();
    wrapper.setState({ chartType: mockChartTypeTB });
    const spy = sinon.spy(wrapper.instance(), 'validate');

    wrapper.instance().changeChartType(mockChartTypeBarChart);
    expect(spy.callCount).to.equal(1);
    expect(wrapper.state().chartType).to.equal(mockChartTypeBarChart);
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
    wrapper.setState({ chartType: mockChartTypeTB });
    const spy = sinon.spy(wrapper.instance(), 'buildVizOptions');
    wrapper.instance().buildVizOptions();
    expect(spy.returnValues[0]).to.deep.equal({
      chartType: wrapper.state().chartType.value,
      datasourceName: wrapper.state().datasourceName,
      columns: wrapper.state().columns,
      schema: 'test_schema',
      sql: wrapper.instance().props.query.sql,
      dbId: wrapper.instance().props.query.dbId,
      templateParams: wrapper.instance().props.templateParams,
    });
  });

  it('should build visualize advise for long query', () => {
    const longQuery = { ...queries[0], endDttm: 1476910666798 };
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
      chartType: mockChartTypeBarChart,
      columns: mockColumns,
      datasourceName: 'mockDatasourceName',
    });

    let ajaxSpy;
    let datasourceSpy;
    beforeEach(() => {
      ajaxSpy = sinon.spy($, 'ajax');
      sinon.stub(JSON, 'parse').callsFake(() => ({ table_id: 107 }));
      sinon.stub(exploreUtils, 'getExploreUrlAndPayload').callsFake(() => ({ url: 'mockURL', payload: { datasource: '107__table' } }));
      sinon.spy(exploreUtils, 'exportChart');
      sinon.stub(wrapper.instance(), 'buildVizOptions').callsFake(() => (mockOptions));
      datasourceSpy = sinon.stub(actions, 'createDatasource');
    });
    afterEach(() => {
      ajaxSpy.restore();
      JSON.parse.restore();
      exploreUtils.getExploreUrlAndPayload.restore();
      exploreUtils.exportChart.restore();
      wrapper.instance().buildVizOptions.restore();
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
      const infoToastSpy = sinon.spy();

      datasourceSpy.callsFake(() => {
        const d = $.Deferred();
        d.resolve('done');
        return d.promise();
      });

      wrapper.setProps({
        actions: {
          createDatasource: datasourceSpy,
          addInfoToast: infoToastSpy,
        },
      });

      wrapper.instance().visualize();
      expect(exploreUtils.exportChart.callCount).to.equal(1);
      expect(exploreUtils.exportChart.getCall(0).args[0].datasource).to.equal('107__table');
      expect(infoToastSpy.callCount).to.equal(1);
    });
    it('should add error toast', () => {
      const dangerToastSpy = sinon.spy();

      datasourceSpy.callsFake(() => {
        const d = $.Deferred();
        d.reject('error message');
        return d.promise();
      });


      wrapper.setProps({
        actions: {
          createDatasource: datasourceSpy,
          addDangerToast: dangerToastSpy,
        },
      });

      wrapper.instance().visualize();
      expect(exploreUtils.exportChart.callCount).to.equal(0);
      expect(dangerToastSpy.callCount).to.equal(1);
    });
  });
});
