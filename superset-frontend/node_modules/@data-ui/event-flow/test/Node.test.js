import React from 'react';
import { shallow } from 'enzyme';
import { Bar } from '@vx/shape';
import Node from '../src/components/Node';

describe('<Node />', () => {
  const props = {
    node: {
      id: 'id',
      depth: 0,
      parent: null,
      children: {},
      events: {},
    },
    x: 14,
    y: 110,
    width: 10,
    height: 10,
    fill: 'maplesyrup',
  };

  it('should be defined', () => {
    expect(Node).toBeDefined();
  });

  it('should render a Bar', () => {
    const wrapper = shallow(<Node {...props} />);
    expect(wrapper.find(Bar)).toHaveLength(1);
  });

  it('should set a data-node attribute', () => {
    const wrapper = shallow(<Node {...props} />);
    expect(wrapper.find('g')).toHaveLength(1);
    expect(wrapper.find('g').props()['data-node']).toBe(props.node.id);
  });

  it('should pass x, y, width, height, and fill props to the Bar', () => {
    const wrapper = shallow(<Node {...props} />);
    const bar = wrapper.find(Bar);
    const barProps = bar.props();

    expect(barProps.width).toBe(props.width);
    expect(barProps.height).toBe(props.height);
    expect(barProps.x).toBe(props.x);
    expect(barProps.y).toBe(props.y);
    expect(barProps.fill).toBe(props.fill);
  });

  it('should not pass negative width or heights', () => {
    const wrapper = shallow(<Node {...props} width={-10} height={-10} />);
    const bar = wrapper.find(Bar);
    const barProps = bar.props();

    expect(barProps.width).toBeGreaterThan(0);
    expect(barProps.height).toBeGreaterThan(0);
  });
});
