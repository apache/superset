import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import { chart as initChart } from '../../../src/chart/chartReducer';
import Chart from '../../../src/chart/Chart';
import ChartBody from '../../../src/chart/ChartBody';
import Loading from '../../../src/components/Loading';

describe('Chart', () => {
  const chart = {
    ...initChart,
    queryResponse: {
      form_data: {},
      error: null,
      status: 'success',
    },
  };
  const mockedProps = {
    ...chart,
    chartKey: 'slice_223',
    containerId: 'slice-container-223',
    datasource: {},
    formData: {},
    vizType: 'pie',
    height: 300,
    width: 400,
    actions: {
      runQuery: () => {},
    },
  };

  let wrapper;
  beforeEach(() => {
    wrapper = shallow(
      <Chart {...mockedProps} />,
    );
  });
  describe('renderViz', () => {
    let stub;
    beforeEach(() => {
      stub = sinon.stub(wrapper.instance(), 'renderViz');
    });
    afterEach(() => {
      stub.restore();
    });

    it('should not call when loading', () => {
      const prevProp = wrapper.props();
      wrapper.setProps({
        height: 100,
      });
      wrapper.instance().componentDidUpdate(prevProp);
      expect(stub.callCount).to.equals(0);
    });

    it('should call after chart stop loading', () => {
      const prevProp = wrapper.props();
      wrapper.setProps({
        chartStatus: 'success',
      });
      wrapper.instance().componentDidUpdate(prevProp);
      expect(stub.callCount).to.equals(1);
    });

    it('should call after resize', () => {
      const prevProp = wrapper.props();
      wrapper.setProps({
        chartStatus: 'rendered',
        height: 100,
      });
      wrapper.instance().componentDidUpdate(prevProp);
      expect(stub.callCount).to.equals(1);
    });
  });

  describe('render', () => {
    it('should render ChartBody after loading is completed', () => {
      expect(wrapper.find(Loading)).to.have.length(1);
      expect(wrapper.find(ChartBody)).to.have.length(0);
    });
  });
});
