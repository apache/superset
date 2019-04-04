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

  test('it should be defined', () => {
    expect(XAxis).toBeDefined();
  });

  test('It should render the appropriate axis based on props.orientation', () => {
    const bottomAxis = shallow(<XAxis {...props} orientation="bottom" />);
    const topAxis = shallow(<XAxis {...props} orientation="top" />);

    expect(bottomAxis.find(AxisBottom).length).toBe(1);
    expect(bottomAxis.find(AxisTop).length).toBe(0);

    expect(topAxis.find(AxisBottom).length).toBe(0);
    expect(topAxis.find(AxisTop).length).toBe(1);
  });

  test('It should render a label if passed', () => {
    const wrapper = shallow(<XAxis {...props} label="banana" />);
    expect(wrapper.render().find('.vx-axis-label').first().text()).toBe('banana');
  });

  test('It should use the output of tickFormat() for ticks', () => {
    const tickFormat = () => 'iNvaRiAnT LabEl';
    const wrapper = shallow(<XAxis {...props} tickFormat={tickFormat} />);
    const tick = wrapper.render().find('.vx-axis-tick').first();
    expect(tick.find('text').text()).toBe(tickFormat());
  });
});
