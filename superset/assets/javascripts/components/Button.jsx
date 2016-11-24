import React, { PropTypes } from 'react';
import { Button as BootstrapButton, Tooltip, OverlayTrigger } from 'react-bootstrap';
import { slugify } from '../modules/utils';

const propTypes = {
  tooltip: PropTypes.node,
  placement: PropTypes.string,
};
const defaultProps = {
  bsSize: 'sm',
  placement: 'top',
};

export default function Button(props) {
  const buttonProps = Object.assign({}, props);
  const tooltip = props.tooltip;
  const placement = props.placement;
  delete buttonProps.tooltip;
  delete buttonProps.placement;

  let button = (
    <BootstrapButton {...buttonProps} >
      {props.children}
    </BootstrapButton>
  );
  if (props.tooltip) {
    button = (
      <OverlayTrigger
        placement={placement}
        overlay={<Tooltip id={`${slugify(tooltip)}-tooltip`}>{tooltip}</Tooltip>}
      >
        {button}
      </OverlayTrigger>
    );
  }
  return button;
}

Button.propTypes = propTypes;
Button.defaultProps = defaultProps;
