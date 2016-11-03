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

export default function TextAreaField({ label, description }) {
  return (
    <FormGroup controlId="formControlsTextarea">
      <ControlLabelWithTooltip label={label} description={description} />
      <FormControl componentClass="textarea" placeholder="textarea" />
    </FormGroup>
  );
}

TextAreaField.propTypes = propTypes;
TextAreaField.defaultProps = defaultProps;
