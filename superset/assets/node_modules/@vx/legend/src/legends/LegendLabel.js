import React from 'react';
import PropTypes from 'prop-types';

LegendLabel.propTypes = {
  label: PropTypes.string.isRequired,
  margin: PropTypes.string.isRequired,
};

export default function LegendLabel({
  label,
  margin,
  align,
}) {
  return (
    <div
      className='vx-legend-label'
      style={{
        justifyContent: align,
        display: 'flex',
        flex: '1',
        margin,
      }}
    >
      {label}
    </div>
  );
}