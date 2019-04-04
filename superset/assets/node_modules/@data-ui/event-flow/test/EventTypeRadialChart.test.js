import React from 'react';
import { shallow } from 'enzyme';
import { RadialChart } from '@data-ui/radial-chart';

import EventTypeRadialChart from '../src/components/EventTypeRadialChart';

describe('<EventTypeRadialChart />', () => {
  const props = {
    data: [
      { value: 20, label: 'a' },
      { value: 20, label: 'b' },
      { value: 20, label: 'c' },
    ],
    width: 100,
    height: 100,
    colorScale: () => '#fff',
  };

  test('it should be defined', () => {
    expect(EventTypeRadialChart).toBeDefined();
  });

  test('it should render a <RadialChart />', () => {
    const wrapper = shallow(<EventTypeRadialChart {...props} />);
    expect(wrapper.find(RadialChart).length).toBe(1);
  });
});
