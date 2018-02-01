import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import { chart as initChart } from '../../../javascripts/chart/chartReducer';
import Chart from '../../../javascripts/chart/Chart';

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

  describe('renderViz', () => {
    let wrapper;
    let stub;
    beforeEach(() => {
      wrapper = shallow(
        <Chart {...mockedProps} />,
      );
      stub = sinon.stub(wrapper.instance(), 'renderViz');
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
});
