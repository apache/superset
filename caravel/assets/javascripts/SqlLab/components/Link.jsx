import React from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';


class Link extends React.Component {
  render() {
    let tooltip = (
      <Tooltip id="tooltip">
        {this.props.tooltip}
      </Tooltip>
    );
    const link = (
      <a
        href={this.props.href}
        onClick={this.props.onClick}
        style={this.props.style}
        className={'Link ' + this.props.className}
      >
          {this.props.children}
      </a>
    );
    if (this.props.tooltip) {
      return (
        <OverlayTrigger
          overlay={tooltip}
          placement={this.props.placement}
          delayShow={300}
          delayHide={150}
        >
          {link}
        </OverlayTrigger>
      );
    }
    return link;
  }
}
Link.propTypes = {
  children: React.PropTypes.object,
  className: React.PropTypes.string,
  href: React.PropTypes.string,
  onClick: React.PropTypes.func,
  placement: React.PropTypes.string,
  style: React.PropTypes.object,
  tooltip: React.PropTypes.string,
};
Link.defaultProps = {
  disabled: false,
  href: '#',
  tooltip: null,
  placement: 'top',
  onClick: () => {},
};

export default Link;
