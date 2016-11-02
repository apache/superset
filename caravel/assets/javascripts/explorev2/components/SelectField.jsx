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

export default function SelectField({ label, description }) {
  return (
    <FormGroup controlId={`formControlsSelect-${label}`}>
      <ControlLabelWithTooltip label={label} description={description} />
      <FormControl componentClass="select" placeholder="select">
        <option value="select">select</option>
        <option value="other">...</option>
      </FormControl>
    </FormGroup>
  );
}

SelectField.propTypes = propTypes;
SelectField.defaultProps = defaultProps;
