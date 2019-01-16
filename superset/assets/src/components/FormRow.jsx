import React from 'react';
import PropTypes from 'prop-types';
import { Row, Col } from 'react-bootstrap';

import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';

const STYLE_ROW = { marginTop: '5px', minHeight: '30px' };
const STYLE_RALIGN = { textAlign: 'right' };

const propTypes = {
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string,
  control: PropTypes.node.isRequired,
  isCheckbox: PropTypes.bool,
};

const defaultProps = {
  tooltip: null,
  isCheckbox: false,
};

export default function FormRow({ label, tooltip, control, isCheckbox }) {
  const labelAndTooltip = (
    <span>
      {label}{' '}
      {tooltip &&
        <InfoTooltipWithTrigger
          placement="top"
          label={label}
          tooltip={tooltip}
        />}
    </span>);
  if (isCheckbox) {
    return (
      <Row style={STYLE_ROW}>
        <Col md={4} style={STYLE_RALIGN}>{control}</Col>
        <Col md={8}>{labelAndTooltip}</Col>
      </Row>);
  }
  return (
    <Row style={STYLE_ROW}>
      <Col md={4} style={STYLE_RALIGN}>{labelAndTooltip}</Col>
      <Col md={8}>{control}</Col>
    </Row>);
}
FormRow.propTypes = propTypes;
FormRow.defaultProps = defaultProps;
