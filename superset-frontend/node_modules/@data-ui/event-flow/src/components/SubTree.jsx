import { Group } from '@vx/group';
import React from 'react';
import PropTypes from 'prop-types';

import Link from './Link';
import Node, { DEFAULT_NODE_WIDTH } from './Node';

import { EVENT_COUNT } from '../constants';
import getCoordsFromEvent from '../utils/getCoordsFromEvent';
import { nodeShape } from '../propShapes';

const propTypes = {
  nodes: PropTypes.objectOf(nodeShape).isRequired,
  nodeSorter: PropTypes.func, // could default to # events

  xScale: PropTypes.func.isRequired,
  yScale: PropTypes.func.isRequired,
  colorScale: PropTypes.func.isRequired,

  getX: PropTypes.func.isRequired,
  getY: PropTypes.func.isRequired,
  getColor: PropTypes.func.isRequired,
  yOffset: PropTypes.number,

  onMouseOver: PropTypes.func,
  onMouseOut: PropTypes.func,
  onClick: PropTypes.func,
};

const defaultProps = {
  nodeSorter: (a, b) => b[EVENT_COUNT] - a[EVENT_COUNT],
  onMouseOut: () => {},
  onMouseOver: () => {},
  onClick: () => {},
  yOffset: 0,
};

class SubTree extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {};

    this.handleClickNode = this.handleClickNode.bind(this);
    this.handleClickLink = this.handleClickLink.bind(this);
    this.handleMouseOver = this.handleMouseOver.bind(this);
    this.handleMouseOut = this.handleMouseOut.bind(this);
  }

  getNodeFromTarget(target) {
    if (target) {
      const result = { node: null, link: null };
      const { nodes } = this.props;
      const hasDataAttr = target.attributes['data-node'] || target.attributes['data-target'];
      const group = hasDataAttr ? target : target.parentElement;
      if (group && group.attributes['data-node']) {
        result.node = nodes[group.attributes['data-node'].value];
      } else if (group && group.attributes['data-target']) {
        const targetNode = nodes[group.attributes['data-target'].value];
        result.link = {
          source: targetNode.parent,
          target: targetNode,
        };
      }

      return result;
    }

    return null;
  }

  handleMouseOver(event) {
    const { target } = event;
    const { node, link } = this.getNodeFromTarget(target);
    if (node || link) {
      const coords = getCoordsFromEvent(target, event);
      this.props.onMouseOver({ node, link, coords, event });
    }
  }

  handleMouseOut() {
    this.props.onMouseOut();
  }

  handleClickNode(event) {
    const { target } = event;
    const { node } = this.getNodeFromTarget(target);
    if (node) {
      const coords = getCoordsFromEvent(target, event);
      this.props.onClick({ coords, event, node });
    }
  }

  handleClickLink(event) {
    const { target } = event;
    const { link } = this.getNodeFromTarget(target);
    if (link) {
      const coords = getCoordsFromEvent(target, event);
      this.props.onClick({ coords, event, node: link.target });
    }
  }

  render() {
    const {
      nodeSorter,
      nodes,
      xScale,
      yScale,
      colorScale,
      getX,
      getY,
      getColor,
      yOffset: parentYOffset,
    } = this.props;

    const sortedNodes = Object.values(nodes).sort(nodeSorter);
    const yOffset = { left: parentYOffset, right: parentYOffset };

    return (
      <Group className="subtree">
        {sortedNodes.map(node => {
          const offset = node.depth >= 0 ? 'right' : 'left';
          const hasParent = Boolean(node.parent);
          const hasChildren = node.children && Object.keys(node.children).length;

          const top = yOffset[offset];
          const left = xScale(getX(node));
          const parentLeft = hasParent && xScale(getX(node.parent));

          const height = yScale(getY(node));
          const nodeColor = colorScale(getColor(node));

          yOffset[offset] += height;

          return (
            <Group key={node.id} style={{ cursor: 'pointer' }}>
              {hasChildren && <SubTree {...this.props} yOffset={top} nodes={node.children} />}
              {/* link back to the parent */}
              {hasParent && (
                <Link // eslint-disable-line jsx-a11y/mouse-events-have-key-events, jsx-a11y/anchor-is-valid
                  source={node.parent}
                  target={node}
                  x={Math.min(left, parentLeft) + (left > parentLeft ? DEFAULT_NODE_WIDTH : 0)}
                  y={top}
                  width={Math.abs(left - parentLeft)}
                  height={Math.max(1, height)}
                  onClick={this.handleClickLink}
                  onMouseOver={this.handleMouseOver}
                  onMouseOut={this.handleMouseOut}
                />
              )}
              <Node // eslint-disable-line jsx-a11y/mouse-events-have-key-events
                node={node}
                x={left}
                y={top}
                height={Math.max(1, height)}
                fill={nodeColor}
                onClick={this.handleClickNode}
                onMouseOver={this.handleMouseOver}
                onMouseOut={this.handleMouseOut}
                data-node={node.id}
              />
            </Group>
          );
        })}
      </Group>
    );
  }
}

SubTree.propTypes = propTypes;
SubTree.defaultProps = defaultProps;

export default SubTree;
