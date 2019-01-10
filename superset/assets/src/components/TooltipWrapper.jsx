import React from 'react';
import PropTypes from 'prop-types';
import { kebabCase } from 'lodash';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';

const propTypes = {
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.node.isRequired,
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
      overlay={<Tooltip id={`${kebabCase(label)}-tooltip`}>{tooltip}</Tooltip>}
    >
      {children}
    </OverlayTrigger>
  );
}

TooltipWrapper.propTypes = propTypes;
TooltipWrapper.defaultProps = defaultProps;
