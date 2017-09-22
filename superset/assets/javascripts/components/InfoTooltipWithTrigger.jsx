import React from 'react';
import PropTypes from 'prop-types';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';
import { slugify } from '../modules/utils';

const propTypes = {
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.string,
  icon: PropTypes.string,
  className: PropTypes.string,
  onClick: PropTypes.func,
  placement: PropTypes.string,
  bsStyle: PropTypes.string,
};
const defaultProps = {
  icon: 'info-circle',
  className: 'text-muted',
  placement: 'right',
};
const tooltipStyle = { wordWrap: 'break-word' };

export default function InfoTooltipWithTrigger({
    label, tooltip, icon, className, onClick, placement, bsStyle }) {
  const iconClass = `fa fa-${icon} ${className} ${bsStyle ? 'text-' + bsStyle : ''}`;
  const iconEl = (
    <i
      className={iconClass}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : null }}
    />
  );
  if (!tooltip) {
    return iconEl;
  }
  return (
    <OverlayTrigger
      placement={placement}
      overlay={
        <Tooltip id={`${slugify(label)}-tooltip`} style={tooltipStyle}>
          {tooltip}
        </Tooltip>
      }
    >
      {iconEl}
    </OverlayTrigger>
  );
}

InfoTooltipWithTrigger.propTypes = propTypes;
InfoTooltipWithTrigger.defaultProps = defaultProps;
