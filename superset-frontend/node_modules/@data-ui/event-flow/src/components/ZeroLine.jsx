import { Line } from '@vx/shape';
import { Point } from '@vx/point';
import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  xScale: PropTypes.func.isRequired,
  yScale: PropTypes.func.isRequired,
};

export default function ZeroLine({ xScale, yScale }) {
  const [y0, y1] = yScale.range();
  const x = xScale(0);
  const fromPoint = new Point({ x, y: y0 });
  const toPoint = new Point({ x, y: y1 });

  return (
    <Line
      from={fromPoint}
      to={toPoint}
      strokeWidth={2}
      strokeDasharray="8 4"
      stroke="#484848"
      vectorEffect="non-scaling-stroke"
    />
  );
}

ZeroLine.propTypes = propTypes;
