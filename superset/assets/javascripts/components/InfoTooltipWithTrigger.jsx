import React from 'react';
import PropTypes from 'prop-types';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';
import { slugify } from '../modules/utils';

const propTypes = {
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string.isRequired,
  icon: PropTypes.string,
  className: PropTypes.string,
  onClick: PropTypes.func,
  placement: PropTypes.string,
};
const defaultProps = {
  icon: 'info-circle',
  className: 'text-muted',
  placement: 'right',
};

export default function InfoTooltipWithTrigger({
    label, tooltip, icon, className, onClick, placement }) {
  return (
    <OverlayTrigger
      placement={placement}
      overlay={<Tooltip id={`${slugify(label)}-tooltip`}>{tooltip}</Tooltip>}
    >
      <i
        className={`fa fa-${icon} ${className}`}
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : null }}
      />
    </OverlayTrigger>
  );
}

InfoTooltipWithTrigger.propTypes = propTypes;
InfoTooltipWithTrigger.defaultProps = defaultProps;
