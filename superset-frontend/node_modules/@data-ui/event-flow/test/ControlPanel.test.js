import React from 'react';
import { shallow } from 'enzyme';
import { Button, Select, StepIncrementer } from '@data-ui/forms';

import ControlPanel from '../src/components/ControlPanel';
import EventTypeLegend from '../src/components/EventTypeLegend';
import EventTypeRadialChart from '../src/components/EventTypeRadialChart';
import { scales } from '../src/fixtures/testFixtures';
import { ELAPSED_TIME_SCALE, NODE_COLOR_SCALE, EVENT_COUNT_SCALE } from '../src/constants';

describe('<ControlPanel />', () => {
  const props = {
    alignByIndex: 0,
    alignByEventType: 'ANY_EVENT_TYPE',
    orderBy: 'EVENT_COUNT',
    colorScale: scales[NODE_COLOR_SCALE],
    minEventCount: 1,
    xScaleType: ELAPSED_TIME_SCALE,
    yScaleType: EVENT_COUNT_SCALE,
    showControls: true,
  };

  it('should be defined', () => {
    expect(ControlPanel).toBeDefined();
  });

  it('should render a Button', () => {
    const wrapper = shallow(<ControlPanel {...props} />);
    expect(wrapper.find(Button)).toHaveLength(1);
  });

  it('should render a select for x-axis, event alignment, and order by', () => {
    const wrapper = shallow(<ControlPanel {...props} />);
    expect(wrapper.find(Select)).toHaveLength(3);
  });

  it('should render a stepper for alignment and for min event count)', () => {
    const wrapper = shallow(<ControlPanel {...props} />);
    expect(wrapper.find(StepIncrementer)).toHaveLength(2);
  });

  it('should hide controls when showControls=false', () => {
    const wrapper = shallow(<ControlPanel {...props} showControls={false} />);
    expect(wrapper.find(Button)).toHaveLength(1);
    expect(wrapper.find(Select)).toHaveLength(0);
    expect(wrapper.find(StepIncrementer)).toHaveLength(0);
  });

  it('should render a radial chart', () => {
    const wrapper = shallow(<ControlPanel {...props} />);
    expect(wrapper.find(EventTypeRadialChart)).toHaveLength(1);
  });

  it('should render a legend', () => {
    const wrapper = shallow(<ControlPanel {...props} />);
    expect(wrapper.find(EventTypeLegend)).toHaveLength(1);
  });
});
