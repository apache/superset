import React from 'react';
import PropTypes from 'prop-types';
import { FormControl } from 'react-bootstrap';

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
};

const defaultProps = {
  onChange: () => {},
};

export default function HiddenControl(props) {
  // This wouldn't be necessary but might as well
  return <FormControl type="hidden" value={props.value} />;
}

HiddenControl.propTypes = propTypes;
HiddenControl.defaultProps = defaultProps;
