import React, { PropTypes } from 'react';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';
import { slugify } from '../modules/utils';

const propTypes = {
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string.isRequired,
};

export default function InfoTooltipWithTrigger({ label, tooltip }) {
  return (
    <OverlayTrigger
      placement="right"
      overlay={<Tooltip id={`${slugify(label)}-tooltip`}>{tooltip}</Tooltip>}
    >
      <i className="fa fa-question-circle-o" />
    </OverlayTrigger>
  );
}

InfoTooltipWithTrigger.propTypes = propTypes;
