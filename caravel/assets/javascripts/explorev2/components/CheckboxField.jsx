import React, { PropTypes } from 'react';
import { Checkbox } from 'react-bootstrap';
import ControlLabelWithTooltip from './ControlLabelWithTooltip';

const propTypes = {
  label: PropTypes.string,
  description: PropTypes.string,
};

const defaultProps = {
  label: null,
  description: null,
};

export default function CheckboxField({ label, description }) {
  return (
    <Checkbox>
      <ControlLabelWithTooltip label={label} description={description} />
    </Checkbox>
  );
}

CheckboxField.propTypes = propTypes;
CheckboxField.defaultProps = defaultProps;
