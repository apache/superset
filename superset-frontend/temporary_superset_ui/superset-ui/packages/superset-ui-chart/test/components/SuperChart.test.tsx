import React from 'react';
import { mount, shallow } from 'enzyme';
import { ChartProps } from '../../src';
import {
  ChartKeys,
  DiligentChartPlugin,
  LazyChartPlugin,
  SlowChartPlugin,
} from './MockChartPlugins';
import SuperChart from '../../src/components/SuperChart';

describe('SuperChart', () => {
  const chartProps = new ChartProps();

  new DiligentChartPlugin().configure({ key: ChartKeys.DILIGENT }).register();
  new LazyChartPlugin().configure({ key: ChartKeys.LAZY }).register();
  new SlowChartPlugin().configure({ key: ChartKeys.SLOW }).register();

  describe('registered charts', () => {
    it('renders registered chart', done => {
      const wrapper = shallow(
        <SuperChart chartType={ChartKeys.DILIGENT} chartProps={chartProps} />,
      );
      setTimeout(() => {
        expect(wrapper.render().find('div.test-component')).toHaveLength(1);
        done();
      }, 0);
    });
    it('renders registered chart with default export', done => {
      const wrapper = shallow(<SuperChart chartType={ChartKeys.LAZY} />);
      setTimeout(() => {
        expect(wrapper.render().find('div.test-component')).toHaveLength(1);
        done();
      }, 0);
    });
    it('does not render if chartType is not set', done => {
      // @ts-ignore chartType is required
      const wrapper = shallow(<SuperChart />);
      setTimeout(() => {
        expect(wrapper.render().children()).toHaveLength(0);
        done();
      }, 5);
    });
    it('adds id to container if specified', done => {
      const wrapper = shallow(<SuperChart chartType={ChartKeys.DILIGENT} id="the-chart" />);
      setTimeout(() => {
        expect(wrapper.render().attr('id')).toEqual('the-chart');
        done();
      }, 0);
    });
    it('adds class to container if specified', done => {
      const wrapper = shallow(<SuperChart chartType={ChartKeys.DILIGENT} className="the-chart" />);
      setTimeout(() => {
        expect(wrapper.hasClass('the-chart')).toBeTruthy();
        done();
      }, 0);
    });
    it('uses overrideTransformProps when specified', done => {
      const wrapper = shallow(
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          overrideTransformProps={() => ({ message: 'hulk' })}
        />,
      );
      setTimeout(() => {
        expect(
          wrapper
            .render()
            .find('span.message')
            .text(),
        ).toEqual('hulk');
        done();
      }, 0);
    });
    it('uses preTransformProps when specified', done => {
      const chartPropsWithPayload = new ChartProps({
        payload: { message: 'hulk' },
      });
      const wrapper = shallow(
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          preTransformProps={() => chartPropsWithPayload}
          overrideTransformProps={props => props.payload}
        />,
      );
      setTimeout(() => {
        expect(
          wrapper
            .render()
            .find('span.message')
            .text(),
        ).toEqual('hulk');
        done();
      }, 0);
    });
    it('uses postTransformProps when specified', done => {
      const wrapper = shallow(
        <SuperChart
          chartType={ChartKeys.DILIGENT}
          postTransformProps={() => ({ message: 'hulk' })}
        />,
      );
      setTimeout(() => {
        expect(
          wrapper
            .render()
            .find('span.message')
            .text(),
        ).toEqual('hulk');
        done();
      }, 0);
    });
    it('renders if chartProps is not specified', done => {
      const wrapper = shallow(<SuperChart chartType={ChartKeys.DILIGENT} />);
      setTimeout(() => {
        expect(wrapper.render().find('div.test-component')).toHaveLength(1);
        done();
      }, 0);
    });
    it('does not render anything while waiting for Chart code to load', done => {
      const wrapper = shallow(<SuperChart chartType={ChartKeys.SLOW} />);
      setTimeout(() => {
        expect(wrapper.render().children()).toHaveLength(0);
        done();
      }, 0);
    });
    it('eventually renders after Chart is loaded', done => {
      const wrapper = shallow(<SuperChart chartType={ChartKeys.SLOW} />);
      setTimeout(() => {
        expect(wrapper.render().find('div.test-component')).toHaveLength(1);
        done();
      }, 1500);
    });
    it('does not render if chartProps is null', done => {
      const wrapper = shallow(<SuperChart chartType={ChartKeys.DILIGENT} chartProps={null} />);
      setTimeout(() => {
        expect(wrapper.render().find('div.test-component')).toHaveLength(0);
        done();
      }, 0);
    });
  });

  describe('unregistered charts', () => {
    it('renders error message', done => {
      const wrapper = mount(<SuperChart chartType="4d-pie-chart" chartProps={chartProps} />);
      setTimeout(() => {
        expect(wrapper.render().find('.alert')).toHaveLength(1);
        done();
      }, 0);
    });
  });

  describe('.processChartProps()', () => {
    it('use identity functions for unspecified transforms', () => {
      const chart = new SuperChart({
        chartType: ChartKeys.DILIGENT,
      });
      const chartProps2 = new ChartProps();
      expect(chart.processChartProps({ chartProps: chartProps2 })).toBe(chartProps2);
    });
  });
});
