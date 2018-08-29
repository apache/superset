import React from 'react';
import PropTypes from 'prop-types';
import { d3format } from '../../modules/utils';

const propTypes = {
  num: PropTypes.number,
  format: PropTypes.string,
};

function FormattedNumber({ num, format }) {
  if (format) {
    return (
      <span title={num}>{d3format(format, num)}</span>
    );
  }
  return <span>{num}</span>;
}

FormattedNumber.propTypes = propTypes;

export default FormattedNumber;
