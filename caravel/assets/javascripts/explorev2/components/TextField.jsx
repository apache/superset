import React, { PropTypes } from 'react';
import { FormGroup, FormControl } from 'react-bootstrap';
import ControlLabelWithTooltip from './ControlLabelWithTooltip';

const propTypes = {
  label: PropTypes.string,
  description: PropTypes.string,
};

const defaultProps = {
  label: null,
  description: null,
};

export default function TextField({ label, description }) {
  return (
    <FormGroup controlId="formInlineName">
      <ControlLabelWithTooltip label={label} description={description} />
      <FormControl type="text" placeholder="" />
    </FormGroup>
  );
}

TextField.propTypes = propTypes;
TextField.defaultProps = defaultProps;
