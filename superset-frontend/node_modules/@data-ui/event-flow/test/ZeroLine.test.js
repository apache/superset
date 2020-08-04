import React from 'react';
import { shallow } from 'enzyme';
import { Line } from '@vx/shape';
import { scaleLinear } from '@vx/scale';
import ZeroLine from '../src/components/ZeroLine';

describe('<ZeroLine />', () => {
  const props = {
    xScale: scaleLinear({ range: [50, 100], domain: [0, 400] }),
    yScale: scaleLinear({ range: [0, 60], domain: [10, 100] }),
  };

  it('should be defined', () => {
    expect(ZeroLine).toBeDefined();
  });

  it('should render a Line', () => {
    const wrapper = shallow(<ZeroLine {...props} />);
    expect(wrapper.find(Line)).toHaveLength(1);
  });

  it('should render a line corresponding to x=0 and y=[min,max]', () => {
    const wrapper = shallow(<ZeroLine {...props} />).dive();
    const line = wrapper.find('line');
    const lineProps = line.props();
    const expectedX = props.xScale(0);
    const [expectedY1, expectedY2] = props.yScale.range();

    expect(line).toHaveLength(1);
    expect(lineProps.x1).toBe(expectedX);
    expect(lineProps.x2).toBe(expectedX);
    expect(lineProps.y1).toBe(expectedY1);
    expect(lineProps.y2).toBe(expectedY2);
  });
});
