/* eslint-disable import/first */
import React from 'react';
import { mount, shallow } from 'enzyme';

jest.mock('resize-observer-polyfill');
// @ts-ignore
import { triggerResizeObserver } from 'resize-observer-polyfill';
import { WithLegend } from '../../src';

let renderChart = jest.fn();
let renderLegend = jest.fn();

describe('WithLegend', () => {
  beforeEach(() => {
    renderChart = jest.fn(() => <div className="chart" />);
    renderLegend = jest.fn(() => <div className="legend" />);
  });

  it('sets className', () => {
    const wrapper = shallow(
      <WithLegend className="test-class" renderChart={renderChart} renderLegend={renderLegend} />,
    );
    expect(wrapper.hasClass('test-class')).toEqual(true);
  });

  it('renders when renderLegend is not set', done => {
    const wrapper = mount(
      <WithLegend debounceTime={1} width={500} height={500} renderChart={renderChart} />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    setTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(wrapper.render().find('div.chart')).toHaveLength(1);
      expect(wrapper.render().find('div.legend')).toHaveLength(0);
      done();
    }, 100);
  });

  it('renders', done => {
    const wrapper = mount(
      <WithLegend
        debounceTime={1}
        width={500}
        height={500}
        renderChart={renderChart}
        renderLegend={renderLegend}
      />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    setTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(renderLegend).toHaveBeenCalledTimes(1);
      expect(wrapper.render().find('div.chart')).toHaveLength(1);
      expect(wrapper.render().find('div.legend')).toHaveLength(1);
      done();
    }, 100);
  });

  it('renders without width or height', done => {
    const wrapper = mount(
      <WithLegend debounceTime={1} renderChart={renderChart} renderLegend={renderLegend} />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    setTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(renderLegend).toHaveBeenCalledTimes(1);
      expect(wrapper.render().find('div.chart')).toHaveLength(1);
      expect(wrapper.render().find('div.legend')).toHaveLength(1);
      done();
    }, 100);
  });

  it('renders legend on the left', done => {
    const wrapper = mount(
      <WithLegend
        debounceTime={1}
        position="left"
        renderChart={renderChart}
        renderLegend={renderLegend}
      />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    setTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(renderLegend).toHaveBeenCalledTimes(1);
      expect(wrapper.render().find('div.chart')).toHaveLength(1);
      expect(wrapper.render().find('div.legend')).toHaveLength(1);
      done();
    }, 100);
  });

  it('renders legend on the right', done => {
    const wrapper = mount(
      <WithLegend
        debounceTime={1}
        position="right"
        renderChart={renderChart}
        renderLegend={renderLegend}
      />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    setTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(renderLegend).toHaveBeenCalledTimes(1);
      expect(wrapper.render().find('div.chart')).toHaveLength(1);
      expect(wrapper.render().find('div.legend')).toHaveLength(1);
      done();
    }, 100);
  });

  it('renders legend on the top', done => {
    const wrapper = mount(
      <WithLegend
        debounceTime={1}
        position="top"
        renderChart={renderChart}
        renderLegend={renderLegend}
      />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    setTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(renderLegend).toHaveBeenCalledTimes(1);
      expect(wrapper.render().find('div.chart')).toHaveLength(1);
      expect(wrapper.render().find('div.legend')).toHaveLength(1);
      done();
    }, 100);
  });

  it('renders legend on the bottom', done => {
    const wrapper = mount(
      <WithLegend
        debounceTime={1}
        position="bottom"
        renderChart={renderChart}
        renderLegend={renderLegend}
      />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    setTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(renderLegend).toHaveBeenCalledTimes(1);
      expect(wrapper.render().find('div.chart')).toHaveLength(1);
      expect(wrapper.render().find('div.legend')).toHaveLength(1);
      done();
    }, 100);
  });

  it('renders legend with justifyContent set', done => {
    const wrapper = mount(
      <WithLegend
        debounceTime={1}
        position="right"
        legendJustifyContent="flex-start"
        renderChart={renderChart}
        renderLegend={renderLegend}
      />,
    );

    triggerResizeObserver();
    // Have to delay more than debounceTime (1ms)
    setTimeout(() => {
      expect(renderChart).toHaveBeenCalledTimes(1);
      expect(renderLegend).toHaveBeenCalledTimes(1);
      expect(wrapper.render().find('div.chart')).toHaveLength(1);
      expect(wrapper.render().find('div.legend')).toHaveLength(1);
      done();
    }, 100);
  });
});
