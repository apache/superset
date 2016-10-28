import React, { PropTypes } from 'react';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';

const propTypes = {
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string.isRequired,
};

export default function InfoTooltipWithTrigger({ label, tooltip }) {
  return (
    <OverlayTrigger
      placement="right"
      overlay={<Tooltip id={`${label}-tooltip`}>{tooltip}</Tooltip>}
    >
      <i className="fa fa-question-circle-o" />
    </OverlayTrigger>
  );
}

InfoTooltipWithTrigger.propTypes = propTypes;
