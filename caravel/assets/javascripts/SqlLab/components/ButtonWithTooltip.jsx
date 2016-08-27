import React from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';

const ButtonWithTooltip = (props) => {
  let tooltip = (
    <Tooltip id="tooltip">
      {props.tooltip}
    </Tooltip>
  );
  return (
    <OverlayTrigger
      overlay={tooltip}
      delayShow={300}
      placement={props.placement}
      delayHide={150}
    >
      <Button
        onClick={props.onClick}
        bsStyle={props.bsStyle}
        bsSize={props.bsSize}
        disabled={props.disabled}
        className={props.className}
      >
          {props.children}
      </Button>
    </OverlayTrigger>
  );
};

ButtonWithTooltip.defaultProps = {
  onClick: () => {},
  disabled: false,
  placement: 'top',
  bsStyle: 'default',
};

ButtonWithTooltip.propTypes = {
  bsSize: React.PropTypes.string,
  bsStyle: React.PropTypes.string,
  children: React.PropTypes.element,
  className: React.PropTypes.string,
  disabled: React.PropTypes.bool,
  onClick: React.PropTypes.func,
  placement: React.PropTypes.string,
  tooltip: React.PropTypes.string,
};

export default ButtonWithTooltip;
