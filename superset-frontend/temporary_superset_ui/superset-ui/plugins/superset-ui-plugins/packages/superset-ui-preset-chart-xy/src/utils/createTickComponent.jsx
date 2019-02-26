/* eslint-disable no-magic-numbers */

import React from 'react';
import PropTypes from 'prop-types';

export default function createTickComponent({
  labellingStrategy,
  orientation = 'bottom',
  rotation = 40,
  tickTextAnchor = 'start',
}) {
  if (labellingStrategy === 'rotate' && rotation !== 0) {
    let xOffset = rotation > 0 ? -6 : 6;
    if (orientation === 'top') {
      xOffset = 0;
    }
    const yOffset = orientation === 'top' ? -3 : 0;

    const propTypes = {
      dy: PropTypes.number,
      formattedValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      x: PropTypes.number.isRequired,
      y: PropTypes.number.isRequired,
    };
    const defaultProps = {
      dy: null,
      formattedValue: '',
    };

    const TickComponent = ({ x, y, dy, formattedValue, ...textStyle }) => (
      <g transform={`translate(${x + xOffset}, ${y + yOffset})`}>
        <text transform={`rotate(${rotation})`} {...textStyle} textAnchor={tickTextAnchor}>
          {formattedValue}
        </text>
      </g>
    );

    TickComponent.propTypes = propTypes;
    TickComponent.defaultProps = defaultProps;

    return TickComponent;
  }

  // This will render the tick as horizontal string.
  return null;
}
