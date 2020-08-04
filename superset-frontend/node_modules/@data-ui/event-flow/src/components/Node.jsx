import { Bar } from '@vx/shape';
import React from 'react';
import PropTypes from 'prop-types';

import { nodeShape } from '../propShapes';

export const DEFAULT_NODE_WIDTH = 7;

const propTypes = {
  node: nodeShape.isRequired,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  width: PropTypes.number,
  height: PropTypes.number.isRequired,
  fill: PropTypes.string,
  onMouseOver: PropTypes.func,
  onMouseOut: PropTypes.func,
  onClick: PropTypes.func,
};

const defaultProps = {
  width: DEFAULT_NODE_WIDTH,
  fill: 'magenta',
  onMouseOver: null,
  onMouseOut: null,
  onClick: null,
};

class Node extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
    this.handleMouseOut = this.handleMouseOut.bind(this);
    this.handleMouseOver = this.handleMouseOver.bind(this);

    this.state = {
      isMousedOver: false,
    };
  }

  handleClick(e) {
    this.props.onClick(e);
  }

  handleMouseOver(e) {
    this.setState({ isMousedOver: true });
    this.props.onMouseOver(e);
  }

  handleMouseOut(e) {
    this.setState({ isMousedOver: false });
    this.props.onMouseOut(e);
  }

  render() {
    const { isMousedOver } = this.state;

    const { node, x, y, width, height, fill } = this.props;

    return (
      <g
        onClick={this.handleClick}
        onMouseOver={this.handleMouseOver}
        onMouseOut={this.handleMouseOut}
        onFocus={this.handleMouseOver}
        onBlur={this.handleMouseOut}
        data-node={node.id}
      >
        <Bar
          x={x}
          y={y}
          width={Math.max(1, width)}
          height={Math.max(1, height)}
          fill={fill}
          stroke={isMousedOver ? '#484848' : '#FFF'}
          strokeWidth={isMousedOver ? 2 : 1}
          rx={2}
          ry={2}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    );
  }
}

Node.propTypes = propTypes;
Node.defaultProps = defaultProps;

export default Node;
