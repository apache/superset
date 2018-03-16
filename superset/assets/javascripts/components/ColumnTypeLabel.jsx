import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  type: PropTypes.string.isRequired,
};

export default function ColumnTypeLabel({ type }) {
  let stringIcon = '';
  if (type === '' || type === 'expression') {
    stringIcon = 'ƒ';
  } else if (type.match(/.*char.*/i) || type.match(/string.*/i) || type.match(/.*text.*/i)) {
    stringIcon = 'ABC';
  } else if (type.match(/.*int.*/i) || type === 'LONG' || type === 'DOUBLE') {
    stringIcon = '#';
  } else if (type.match(/.*bool.*/i)) {
    stringIcon = 'T/F';
  } else if (type.match(/.*time.*/i)) {
    stringIcon = 'time';
  } else if (type.match(/unknown/i)) {
    stringIcon = '?';
  }

  const typeIcon = stringIcon === 'time' ?
    <i className="fa fa-clock-o type-label" /> :
    <div className="type-label">{stringIcon}</div>;

  return (
    <span>
      {typeIcon}
    </span>);
}
ColumnTypeLabel.propTypes = propTypes;
