import { css, StyleSheet } from 'aphrodite';
import { Bar } from '@vx/shape';
import React from 'react';
import PropTypes from 'prop-types';

import { nodeShape } from '../propShapes';

const DEFAULT_LINK_COLOR = '#ddd';

const styles = StyleSheet.create({
  group: {
    ':hover': {
      opacity: 0.4,
    },
  },
});

const propTypes = {
  source: nodeShape.isRequired,
  target: nodeShape.isRequired,
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  fill: PropTypes.string,
  onMouseOver: PropTypes.func,
  onMouseOut: PropTypes.func,
  onClick: PropTypes.func,
};

const defaultProps = {
  fill: DEFAULT_LINK_COLOR,
  onMouseOver: null,
  onMouseOut: null,
  onClick: null,
};

function Link({ source, target, x, y, width, height, fill, onClick, onMouseOver, onMouseOut }) {
  return (
    <g
      className={css(styles.group)}
      onClick={onClick}
      onMouseOver={onMouseOver}
      onMouseOut={onMouseOut}
      onFocus={onMouseOver}
      onBlur={onMouseOut}
      data-source={source.id}
      data-target={target.id}
    >
      <Bar
        x={x}
        y={y}
        width={Math.max(1, width)}
        height={Math.max(1, height)}
        fill={fill}
        fillOpacity={0.9}
        rx={2}
        ry={2}
        stroke="#fff"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

Link.propTypes = propTypes;
Link.defaultProps = defaultProps;

export default Link;
