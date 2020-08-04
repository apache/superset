import React from 'react';
import { shallow } from 'enzyme';
import { AxisBottom, AxisTop } from '@vx/axis';
import { scaleLinear } from '@vx/scale';
import XAxis from '../src/components/XAxis';

describe('<XAxis />', () => {
  const props = {
    scale: scaleLinear({ range: [0, 10], domain: [-5, 400] }),
    height: 100,
  };

  it('should be defined', () => {
    expect(XAxis).toBeDefined();
  });

  it('should render the appropriate axis based on props.orientation', () => {
    const bottomAxis = shallow(<XAxis {...props} orientation="bottom" />);
    const topAxis = shallow(<XAxis {...props} orientation="top" />);

    expect(bottomAxis.find(AxisBottom)).toHaveLength(1);
    expect(bottomAxis.find(AxisTop)).toHaveLength(0);

    expect(topAxis.find(AxisBottom)).toHaveLength(0);
    expect(topAxis.find(AxisTop)).toHaveLength(1);
  });

  it('should render a label if passed', () => {
    const wrapper = shallow(<XAxis {...props} label="banana" />);
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
    const wrapper = shallow(<XAxis {...props} tickFormat={tickFormat} />);
    const tick = wrapper
      .render()
      .find('.vx-axis-tick')
      .first();
    expect(tick.find('text').text()).toBe(tickFormat());
  });
});
