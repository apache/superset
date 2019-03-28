/* eslint-disable no-magic-numbers */

import React, { CSSProperties } from 'react';

export default function createTickComponent({
  labelAngle,
  labelOverlap,
  orient,
  tickTextAnchor = 'start',
}: {
  labelAngle: number;
  labelOverlap: string;
  orient: string;
  tickTextAnchor?: string;
}) {
  if (labelOverlap === 'rotate' && labelAngle !== 0) {
    let xOffset = labelAngle > 0 ? -6 : 6;
    if (orient === 'top') {
      xOffset = 0;
    }
    const yOffset = orient === 'top' ? -3 : 0;

    const TickComponent = ({
      x,
      y,
      dy,
      formattedValue = '',
      ...textStyle
    }: {
      x: number;
      y: number;
      dy?: number;
      formattedValue: string;
      textStyle: CSSProperties;
    }) => (
      <g transform={`translate(${x + xOffset}, ${y + yOffset})`}>
        <text transform={`rotate(${labelAngle})`} {...textStyle} textAnchor={tickTextAnchor}>
          {formattedValue}
        </text>
      </g>
    );

    return TickComponent;
  }

  // This will render the tick as horizontal string.
  return null;
}
