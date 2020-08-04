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

  it('should be defined', () => {
    expect(NodeSequence).toBeDefined();
  });

  it('should render one span element per node', () => {
    const wrapper = shallow(<NodeSequence {...props} />);
    expect(wrapper.children()).toHaveLength(nodeArray.length);
  });

  it('should add colors using the color scale', () => {
    const { colorScale } = props;
    const wrapper = shallow(<NodeSequence {...props} />);
    const children = wrapper.children();
    children.forEach((child, index) => {
      const node = props.nodeArray[index];
      const { color } = child
        .find('span')
        .last()
        .props().style;
      const expectedColor = colorScale.scale(colorScale.accessor(node));
      expect(color).toBe(expectedColor);
    });
  });
});
