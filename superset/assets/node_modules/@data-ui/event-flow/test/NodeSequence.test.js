import React from 'react';
import { shallow } from 'enzyme';

import NodeSequence from '../src/components/NodeSequence';

import { scales, graph } from '../src/fixtures/testFixtures';

describe('<NodeSequence />', () => {
  const nodeArray = Object.values(graph.nodes).sort((a, b) => a.depth - b.depth);

  const props = {
    nodeArray,
    separator: '!!',
    colorScale: scales.NODE_COLOR_SCALE,
  };

  test('it should be defined', () => {
    expect(NodeSequence).toBeDefined();
  });

  test('it should render one span element per node', () => {
    const wrapper = shallow(<NodeSequence {...props} />);
    expect(wrapper.children().length).toBe(nodeArray.length);
  });

  test('it should add colors using the color scale', () => {
    const colorScale = props.colorScale;
    const wrapper = shallow(<NodeSequence {...props} />);
    const children = wrapper.children();
    children.forEach((child, index) => {
      const node = props.nodeArray[index];
      const color = child.find('span').last().props().style.color;
      const expectedColor = colorScale.scale(colorScale.accessor(node));
      expect(color).toBe(expectedColor);
    });
  });
});
