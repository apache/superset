import React from 'react';
import { shallow } from 'enzyme';
import { RadialChart } from '@data-ui/radial-chart';

import EventTypeRadialChart from '../src/components/EventTypeRadialChart';

describe('<EventTypeRadialChart />', () => {
  const props = {
    data: [{ value: 20, label: 'a' }, { value: 20, label: 'b' }, { value: 20, label: 'c' }],
    width: 100,
    height: 100,
    colorScale: () => '#fff',
  };

  it('should be defined', () => {
    expect(EventTypeRadialChart).toBeDefined();
  });

  it('should render a <RadialChart />', () => {
    const wrapper = shallow(<EventTypeRadialChart {...props} />);
    expect(wrapper.find(RadialChart)).toHaveLength(1);
  });
});
