import React from 'react';
import PropTypes from 'prop-types';
import { kebabCase } from 'lodash';
import { Button as BootstrapButton, Tooltip, OverlayTrigger } from 'react-bootstrap';

const propTypes = {
  tooltip: PropTypes.node,
  placement: PropTypes.string,
};
const defaultProps = {
  bsSize: 'sm',
  placement: 'top',
};

const BUTTON_WRAPPER_STYLE = { display: 'inline-block', cursor: 'not-allowed' };

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
  if (tooltip) {
    if (props.disabled) {
      // Working around the fact that tooltips don't get triggered when buttons are disabled
      // https://github.com/react-bootstrap/react-bootstrap/issues/1588
      buttonProps.style = { pointerEvents: 'none' };
      button = (
        <div style={BUTTON_WRAPPER_STYLE}>
          <BootstrapButton {...buttonProps} >
            {props.children}
          </BootstrapButton>
        </div>);
    }
    return (
      <OverlayTrigger
        placement={placement}
        overlay={<Tooltip id={`${kebabCase(tooltip)}-tooltip`}>{tooltip}</Tooltip>}
      >
        {button}
      </OverlayTrigger>
    );
  }
  return button;
}

Button.propTypes = propTypes;
Button.defaultProps = defaultProps;
