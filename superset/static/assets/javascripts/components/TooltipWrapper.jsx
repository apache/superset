import React, { PropTypes } from 'react';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';
import { slugify } from '../modules/utils';

const propTypes = {
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  placement: PropTypes.string,
};

const defaultProps = {
  placement: 'top',
};

export default function TooltipWrapper({ label, tooltip, children, placement }) {
  return (
    <OverlayTrigger
      placement={placement}
      overlay={<Tooltip id={`${slugify(label)}-tooltip`}>{tooltip}</Tooltip>}
    >
      {children}
    </OverlayTrigger>
  );
}

TooltipWrapper.propTypes = propTypes;
TooltipWrapper.defaultProps = defaultProps;
