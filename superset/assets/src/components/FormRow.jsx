import React from 'react';
import PropTypes from 'prop-types';
import { Row, Col } from 'react-bootstrap';

import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';

const STYLE_ROW = { marginTop: '5px', minHeight: '30px' };

const propTypes = {
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string,
  control: PropTypes.node.isRequired,
};

const defaultProps = {
  tooltip: null,
};

export default function FormRow({ label, tooltip, control }) {
  return (
    <Row style={STYLE_ROW}>
      <Col md={5}>
        {label}{' '}
        {tooltip &&
          <InfoTooltipWithTrigger
            placement="top"
            label={label}
            tooltip={tooltip}
          />}
      </Col>
      <Col md={7}>{control}</Col>
    </Row>
  );
}
FormRow.propTypes = propTypes;
FormRow.defaultProps = defaultProps;
