import React from 'react';
import PropTypes from 'prop-types';

export default function LegendItem({
  children,
  flexDirection,
  margin,
}) {
  return (
    <div
      className='vx-legend-item'
      style={{
        display: 'flex',
        alignItems: 'center',
        flexDirection,
        margin,
      }}
    >
      {children}
    </div>
  );
}