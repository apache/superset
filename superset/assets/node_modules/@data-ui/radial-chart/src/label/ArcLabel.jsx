import React from 'react';
import PropTypes from 'prop-types';
import { baseLabel } from '@data-ui/theme/build/svgLabel';

import additionalProps from '../util/additionalProps';

const propTypes = {
  x: PropTypes.number,
  y: PropTypes.number,
  paintOrder: PropTypes.string,
  arc: PropTypes.object, // if passed, will be passed to any restprops
  children: PropTypes.node,
};

const defaultProps = {
  x: 0,
  y: 0,
  paintOrder: 'stroke',
  arc: null,
  children: null,
};

export default function ArcLabel({ x, y, children, arc, ...rest }) {
  return (
    <text
      x={x}
      y={y}
      {...baseLabel}
      {...additionalProps(rest, arc)}
    >
      {children}
    </text>
  );
}

ArcLabel.propTypes = propTypes;
ArcLabel.defaultProps = defaultProps;
