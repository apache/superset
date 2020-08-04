import React from 'react';
import { shallow } from 'enzyme';
import { AxisLeft, AxisRight } from '@vx/axis';
import { scaleLinear } from '@vx/scale';
import YAxis from '../src/components/YAxis';

describe('<YAxis />', () => {
  const props = {
    scale: scaleLinear({ range: [0, 10], domain: [-5, 400] }),
    width: 100,
  };

  it('should be defined', () => {
    expect(YAxis).toBeDefined();
  });

  it('should render the appropriate axis based on props.orientation', () => {
    const leftAxis = shallow(<YAxis {...props} orientation="left" />);
    const rightAxis = shallow(<YAxis {...props} orientation="right" />);

    expect(leftAxis.find(AxisLeft)).toHaveLength(1);
    expect(leftAxis.find(AxisRight)).toHaveLength(0);

    expect(rightAxis.find(AxisLeft)).toHaveLength(0);
    expect(rightAxis.find(AxisRight)).toHaveLength(1);
  });

  it('should render a label if passed', () => {
    const wrapper = shallow(<YAxis {...props} label="banana" />);
    expect(
      wrapper
        .render()
        .find('.vx-axis-label')
        .first()
        .text(),
    ).toBe('banana');
  });

  it('should use the output of tickFormat() for ticks', () => {
    const tickFormat = () => 'iNvaRiAnT LabEl';
    const wrapper = shallow(<YAxis {...props} tickFormat={tickFormat} />);
    const tick = wrapper
      .render()
      .find('.vx-axis-tick')
      .first();
    expect(tick.find('text').text()).toBe(tickFormat());
  });
});
