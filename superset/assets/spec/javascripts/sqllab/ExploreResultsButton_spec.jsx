import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { shallow } from 'enzyme';
import sinon from 'sinon';

import $ from 'jquery';
import shortid from 'shortid';
import { queries, queryWithBadColumns } from './fixtures';
import { sqlLabReducer } from '../../../src/SqlLab/reducers';
import * as actions from '../../../src/SqlLab/actions';
import ExploreResultsButton from '../../../src/SqlLab/components/ExploreResultsButton';
import * as exploreUtils from '../../../src/explore/exploreUtils';
import Button from '../../../src/components/Button';

describe('ExploreResultsButton', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const database = {
    allows_subquery: true,
  };
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
    database,
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
  const getExploreResultsButtonWrapper = (props = mockedProps) => (
    shallow(<ExploreResultsButton {...props} />, {
      context: { store },
    }).dive());

  it('renders', () => {
    expect(React.isValidElement(<ExploreResultsButton />)).toBe(true);
  });

  it('renders with props', () => {
    expect(
      React.isValidElement(<ExploreResultsButton {...mockedProps} />),
    ).toBe(true);
  });

  it('detects bad columns', () => {
    const wrapper = getExploreResultsButtonWrapper({
      database,
      show: true,
      query: queryWithBadColumns,
    });

    const badCols = wrapper.instance().getInvalidColumns();
    expect(badCols).toEqual(['COUNT(*)', '1', '123', 'CASE WHEN 1=1 THEN 1 ELSE 0 END']);

    const msgWrapper = shallow(wrapper.instance().renderInvalidColumnMessage());
    expect(msgWrapper.find('div')).toHaveLength(1);
  });

  it('renders a Button', () => {
    const wrapper = getExploreResultsButtonWrapper();
    expect(wrapper.find(Button)).toHaveLength(1);
  });

  describe('datasourceName', () => {
    let wrapper;
    let stub;
    beforeEach(() => {
      wrapper = getExploreResultsButtonWrapper();
      stub = sinon.stub(shortid, 'generate').returns('abcd');
    });
    afterEach(() => {
      stub.restore();
    });

    it('should generate data source name from query', () => {
      const sampleQuery = queries[0];
      const name = wrapper.instance().datasourceName();
      expect(name).toBe(`${sampleQuery.user}-${sampleQuery.tab}-abcd`);
    });
    it('should generate data source name with empty query', () => {
      wrapper.setProps({ query: {} });
      const name = wrapper.instance().datasourceName();
      expect(name).toBe('undefined-abcd');
    });

    it('should build viz options', () => {
      wrapper.setState({ chartType: mockChartTypeTB });
      const spy = sinon.spy(wrapper.instance(), 'buildVizOptions');
      wrapper.instance().buildVizOptions();
      expect(spy.returnValues[0]).toEqual({
        schema: 'test_schema',
        sql: wrapper.instance().props.query.sql,
        dbId: wrapper.instance().props.query.dbId,
        columns: Object.values(mockColumns),
        templateParams: undefined,
        datasourceName: 'admin-Demo-abcd',
      });
    });
  });

  it('should build visualize advise for long query', () => {
    const longQuery = { ...queries[0], endDttm: 1476910666798 };
    const props = {
      show: true,
      query: longQuery,
      database,
    };
    const longQueryWrapper = shallow(<ExploreResultsButton {...props} />, {
      context: { store },
    }).dive();
    const inst = longQueryWrapper.instance();
    expect(inst.getQueryDuration()).toBe(100.7050400390625);
  });

  describe('visualize', () => {
    const wrapper = getExploreResultsButtonWrapper();
    const mockOptions = { attr: 'mockOptions' };
    wrapper.setState({
      chartType: mockChartTypeBarChart,
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
      expect(ajaxSpy.callCount).toBe(1);

      const spyCall = ajaxSpy.getCall(0);
      expect(spyCall.args[0].type).toBe('POST');
      expect(spyCall.args[0].url).toBe('/superset/sqllab_viz/');
      expect(spyCall.args[0].data.data).toBe(JSON.stringify(mockOptions));
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
      expect(exploreUtils.exportChart.callCount).toBe(1);
      expect(exploreUtils.exportChart.getCall(0).args[0].datasource).toBe('107__table');
      expect(infoToastSpy.callCount).toBe(1);
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
      expect(exploreUtils.exportChart.callCount).toBe(0);
      expect(dangerToastSpy.callCount).toBe(1);
    });
  });
});
