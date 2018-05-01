import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  style: PropTypes.object,
};

export default function Checkbox({ checked, onChange, style }) {
  return (
    <span style={style}>
      <i
        className={`fa fa-check ${checked ? 'text-primary' : 'text-transparent'}`}
        onClick={onChange.bind(!checked)}
        style={{
          border: '1px solid #aaa',
          borderRadius: '2px',
          cursor: 'pointer',
        }}
      />
    </span>);
}
Checkbox.propTypes = propTypes;
