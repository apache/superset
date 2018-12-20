import React from 'react';
import { mount, shallow } from 'enzyme';
import { ChartProps, ChartMetadata, ChartPlugin, SuperChart } from '../../src';

describe('SuperChart', () => {
  const TestComponent = (props: any) => (
    <div className="test-component">{props.character || 'test-component'}</div>
  );
  const chartProps = new ChartProps();

  class MyChartPlugin extends ChartPlugin {
    constructor() {
      super({
        metadata: new ChartMetadata({
          name: 'my-chart',
          thumbnail: '',
        }),
        Chart: TestComponent,
        transformProps: x => x,
      });
    }
  }

  class SecondChartPlugin extends ChartPlugin {
    constructor() {
      super({
        metadata: new ChartMetadata({
          name: 'second-chart',
          thumbnail: '',
        }),
        loadChart: () => Promise.resolve({ default: TestComponent }),
        transformProps: x => x,
      });
    }
  }

  class SlowChartPlugin extends ChartPlugin {
    constructor() {
      super({
        metadata: new ChartMetadata({
          name: 'slow-chart',
          thumbnail: '',
        }),
        loadChart: () =>
          new Promise<Function>(resolve => {
            setTimeout(() => {
              resolve(TestComponent);
            }, 1000);
          }),
        transformProps: x => x,
      });
    }
  }

  new MyChartPlugin().configure({ key: 'my-chart' }).register();
  new SecondChartPlugin().configure({ key: 'second-chart' }).register();
  new SlowChartPlugin().configure({ key: 'slow-chart' }).register();

  describe('registered charts', () => {
    it('renders registered chart', done => {
      const wrapper = shallow(<SuperChart chartType="my-chart" chartProps={chartProps} />);
      setTimeout(() => {
        expect(wrapper.render().find('div.test-component')).toHaveLength(1);
        done();
      }, 0);
    });
    it('renders registered chart with default export', done => {
      const wrapper = shallow(<SuperChart chartType="second-chart" />);
      setTimeout(() => {
        expect(wrapper.render().find('div.test-component')).toHaveLength(1);
        done();
      }, 0);
    });
    it('adds id to container if specified', done => {
      const wrapper = shallow(<SuperChart chartType="my-chart" id="the-chart" />);
      setTimeout(() => {
        expect(wrapper.render().attr('id')).toEqual('the-chart');
        done();
      }, 0);
    });
    it('adds class to container if specified', done => {
      const wrapper = shallow(<SuperChart chartType="my-chart" className="the-chart" />);
      setTimeout(() => {
        expect(wrapper.hasClass('the-chart')).toBeTruthy();
        done();
      }, 0);
    });
    it('uses overrideTransformProps when specified', done => {
      const wrapper = shallow(
        <SuperChart chartType="my-chart" overrideTransformProps={() => ({ character: 'hulk' })} />,
      );
      setTimeout(() => {
        expect(
          wrapper
            .render()
            .find('div.test-component')
            .text(),
        ).toEqual('hulk');
        done();
      }, 0);
    });
    it('uses preTransformProps when specified', done => {
      const wrapper = shallow(
        <SuperChart chartType="my-chart" preTransformProps={() => ({ character: 'hulk' })} />,
      );
      setTimeout(() => {
        expect(
          wrapper
            .render()
            .find('div.test-component')
            .text(),
        ).toEqual('hulk');
        done();
      }, 0);
    });
    it('uses postTransformProps when specified', done => {
      const wrapper = shallow(
        <SuperChart chartType="my-chart" postTransformProps={() => ({ character: 'hulk' })} />,
      );
      setTimeout(() => {
        expect(
          wrapper
            .render()
            .find('div.test-component')
            .text(),
        ).toEqual('hulk');
        done();
      }, 0);
    });
    it('renders if chartProps is not specified', done => {
      const wrapper = shallow(<SuperChart chartType="my-chart" />);
      setTimeout(() => {
        expect(wrapper.render().find('div.test-component')).toHaveLength(1);
        done();
      }, 0);
    });
    it('does not render anything while waiting for Chart code to load', done => {
      const wrapper = shallow(<SuperChart chartType="slow-chart" />);
      setTimeout(() => {
        expect(wrapper.render().children()).toHaveLength(0);
        done();
      }, 0);
    });
    it('does not render if chartProps is null', done => {
      const wrapper = shallow(<SuperChart chartType="my-chart" chartProps={null} />);
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
        chartType: 'my-chart',
      });
      const chartProps2 = new ChartProps();
      expect(chart.processChartProps({ chartProps: chartProps2 })).toBe(chartProps2);
    });
  });
});
