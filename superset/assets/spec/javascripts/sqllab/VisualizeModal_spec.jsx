import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { Modal } from 'react-bootstrap';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import $ from 'jquery';
import { queries } from './fixtures';
import { sqlLabReducer } from '../../../javascripts/SqlLab/reducers';
import VisualizeModal from '../../../javascripts/SqlLab/components/VisualizeModal';
import * as exploreUtils from '../../../javascripts/explore/exploreUtils';

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
  const mockChartTypeBarChart = {
    label: 'Distribution - Bar Chart',
    requiresTime: false,
    value: 'dist_bar',
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

  describe('visualize', () => {
    const wrapper = getVisualizeModalWrapper();

    wrapper.setState({
      chartType: mockChartTypeBarChart,
      columns: mockColumns,
      datasourceName: 'mockDatasourceName',
    });

    const vizOptions = {
      chartType: wrapper.state().chartType.value,
      datasourceName: wrapper.state().datasourceName,
      columns: wrapper.state().columns,
      sql: wrapper.instance().props.query.sql,
      dbId: wrapper.instance().props.query.dbId,
    };

    let spy;
    let server;

    beforeEach(() => {
      spy = sinon.spy($, 'ajax');
      server = sinon.fakeServer.create();
      sinon.stub(JSON, 'parse').callsFake(() => ({ table_id: 107 }));
      sinon.stub(exploreUtils, 'getExploreUrl').callsFake(() => ('mockURL'));
    });
    afterEach(() => {
      spy.restore();
      server.restore();
      JSON.parse.restore();
      exploreUtils.getExploreUrl.restore();
    });

    it('should build request', () => {
      wrapper.instance().visualize();
      expect(spy.callCount).to.equal(1);

      const spyCall = spy.getCall(0);
      expect(spyCall.args[0].type).to.equal('POST');
      expect(spyCall.args[0].url).to.equal('/superset/sqllab_viz/');
      expect(spyCall.args[0].data.data).to.equal(JSON.stringify(vizOptions));
    });
  });
});
