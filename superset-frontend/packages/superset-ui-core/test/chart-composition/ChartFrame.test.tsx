import React from 'react';
import { shallow } from 'enzyme';
import { ChartFrame } from '@superset-ui/core/src';

describe('TooltipFrame', () => {
  it('renders content that requires smaller space than frame', () => {
    const wrapper = shallow(
      <ChartFrame
        width={400}
        height={400}
        contentWidth={300}
        contentHeight={300}
        renderContent={({ width, height }) => (
          <div>
            {width}/{height}
          </div>
        )}
      />,
    );
    expect(wrapper.find('div').text()).toEqual('400/400');
  });

  it('renders content without specifying content size', () => {
    const wrapper = shallow(
      <ChartFrame
        width={400}
        height={400}
        renderContent={({ width, height }) => (
          <div>
            {width}/{height}
          </div>
        )}
      />,
    );
    expect(wrapper.find('div').text()).toEqual('400/400');
  });

  it('renders content that requires same size with frame', () => {
    const wrapper = shallow(
      <ChartFrame
        width={400}
        height={400}
        contentWidth={400}
        contentHeight={400}
        renderContent={({ width, height }) => (
          <div>
            {width}/{height}
          </div>
        )}
      />,
    );
    expect(wrapper.find('div').text()).toEqual('400/400');
  });

  it('renders content that requires space larger than frame', () => {
    const wrapper = shallow(
      <ChartFrame
        width={400}
        height={400}
        contentWidth={500}
        contentHeight={500}
        renderContent={({ width, height }) => (
          <div className="chart">
            {width}/{height}
          </div>
        )}
      />,
    );
    expect(wrapper.find('div.chart').text()).toEqual('500/500');
  });

  it('renders content that width is larger than frame', () => {
    const wrapper = shallow(
      <ChartFrame
        width={400}
        height={400}
        contentWidth={500}
        renderContent={({ width, height }) => (
          <div className="chart">
            {width}/{height}
          </div>
        )}
      />,
    );
    expect(wrapper.find('div.chart').text()).toEqual('500/400');
  });

  it('renders content that height is larger than frame', () => {
    const wrapper = shallow(
      <ChartFrame
        width={400}
        height={400}
        contentHeight={600}
        renderContent={({ width, height }) => (
          <div className="chart">
            {width}/{height}
          </div>
        )}
      />,
    );
    expect(wrapper.find('div.chart').text()).toEqual('400/600');
  });

  it('renders an empty frame when renderContent is not given', () => {
    const wrapper = shallow(<ChartFrame width={400} height={400} />);
    expect(wrapper.find('div')).toHaveLength(0);
  });
});
