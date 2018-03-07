import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  type: PropTypes.string.isRequired,
};

export default function ColumnTypeLabel({ type }) {
  let stringIcon;
  let iconSize = '13';
  if (type === '' || type === 'expression') {
    stringIcon = 'ƒ';
  } else if (type.match(/.*char.*/i) || type.match(/string.*/i) || type.match(/.*text.*/i)) {
    stringIcon = 'ABC';
    iconSize = '11';
  } else if (type.match(/.*int.*/i) || type === 'LONG' || type === 'DOUBLE') {
    stringIcon = '#';
  } else if (type.match(/.*bool.*/i)) {
    stringIcon = 'T/F';
  } else if (type.match(/.*time.*/i)) {
    stringIcon = 'time';
  } else {
    stringIcon = '?';
  }

  const typeIcon = stringIcon === 'time' ? <i className="fa fa-clock-o text-muted type-label" /> : (
    <div className="text-muted type-label" style={{ fontSize: iconSize }}>{stringIcon}</div>);

  return (
    <span className="m-r-5">
      {typeIcon}
    </span>);
}
ColumnTypeLabel.propTypes = propTypes;
