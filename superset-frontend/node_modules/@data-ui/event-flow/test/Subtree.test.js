import React from 'react';
import { shallow, mount } from 'enzyme';

import SubTree from '../src/components/SubTree';
import Node from '../src/components/Node';
import Link from '../src/components/Link';

import { graph, scales } from '../src/fixtures/testFixtures';
import { ELAPSED_TIME_SCALE, EVENT_COUNT_SCALE, NODE_COLOR_SCALE } from '../src/constants';

const xScale = scales[ELAPSED_TIME_SCALE];
const yScale = scales[EVENT_COUNT_SCALE];
const colorScale = scales[NODE_COLOR_SCALE];
const rootNode = graph.root;
const middleNode = Object.values(graph.nodes).filter(n => n.depth === 1)[0];
const leafNode = Object.values(graph.nodes).filter(n => Object.keys(n.children).length === 0)[0];

describe('<SubTree />', () => {
  const props = {
    xScale: xScale.scale,
    yScale: yScale.scale,
    colorScale: colorScale.scale,
    getX: xScale.accessor,
    getY: yScale.accessor,
    getColor: colorScale.accessor,
    onClick: jest.fn(() => {}),
  };

  it('should be defined', () => {
    expect(SubTree).toBeDefined();
  });

  it('should render a Node for each Node passed', () => {
    const wrapper = shallow(
      <SubTree
        {...props}
        nodes={{
          1: rootNode,
          2: rootNode,
          3: rootNode,
        }}
      />,
    );
    expect(wrapper.find(Node)).toHaveLength(3);
  });

  it('should render a Node and Link for nodes with parents and children', () => {
    const wrapper = shallow(<SubTree {...props} nodes={{ [middleNode.id]: middleNode }} />);
    expect(wrapper.find(Node)).toHaveLength(1);
    expect(wrapper.find(Link)).toHaveLength(1);
  });

  it('should not render a Link for nodes with no parent', () => {
    const wrapper = shallow(
      <SubTree
        {...props}
        nodes={{
          [rootNode.id]: { ...rootNode, parent: null },
        }}
      />,
    );
    expect(wrapper.find(Node)).toHaveLength(1);
    expect(wrapper.find(Link)).toHaveLength(0);
  });

  it('should render a SubTree for nodes with children', () => {
    const wrapper = shallow(<SubTree {...props} nodes={{ [middleNode.id]: middleNode }} />);
    expect(wrapper.find(SubTree)).toHaveLength(1);

    const leafWrapper = shallow(<SubTree {...props} nodes={{ [leafNode.id]: leafNode }} />);
    expect(leafWrapper.find(SubTree)).toHaveLength(0);
  });

  it('node and link clicks should result in onClick calls', () => {
    const wrapper = mount(
      <svg>
        <SubTree {...props} nodes={{ [middleNode.id]: middleNode }} />
      </svg>,
    );

    wrapper
      .find(Node)
      .first()
      .simulate('click');
    expect(props.onClick).toHaveBeenCalledTimes(1);

    wrapper
      .find(Link)
      .first()
      .simulate('click');
    expect(props.onClick).toHaveBeenCalledTimes(2);
  });
});
