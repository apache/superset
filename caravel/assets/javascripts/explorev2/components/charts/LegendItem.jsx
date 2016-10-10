import React, { PropTypes } from 'react';

const propTypes = {
  label: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
};

export default function LegendItem({ label, color }) {
  return (
    <li style={{ float: 'left' }} key={label}>
      <i className="fa fa-circle" style={{ color }} /> &nbsp;&nbsp;
      <span>{label}</span>
    </li>
  );
}

LegendItem.propTypes = propTypes;
