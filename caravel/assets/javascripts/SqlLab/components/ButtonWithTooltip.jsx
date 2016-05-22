import React from 'react';
import { Button, OverlayTrigger, Tooltip } from 'react-bootstrap';


class ButtonWithTooltip extends React.Component {
  render() {
    let tooltip = (
      <Tooltip id="tooltip">
        {this.props.tooltip}
      </Tooltip>
    );
    return (
      <OverlayTrigger
        overlay={tooltip}
        delayShow={300}
        placement={this.props.placement}
        delayHide={150}
      >
        <Button
          onClick={this.props.onClick}
          bsStyle={this.props.bsStyle}
          disabled={this.props.disabled}
          className={this.props.className}
        >
            {this.props.children}
        </Button>
      </OverlayTrigger>
    );
  }
}
ButtonWithTooltip.defaultProps = {
  onClick: () => {},
  disabled: false,
  placement: 'top',
  bsStyle: 'default',
};

ButtonWithTooltip.propTypes = {
  bsStyle: React.PropTypes.string,
  children: React.PropTypes.element,
  className: React.PropTypes.string,
  disabled: React.PropTypes.bool,
  onClick: React.PropTypes.func,
  placement: React.PropTypes.string,
  tooltip: React.PropTypes.string,
};

export default ButtonWithTooltip;
