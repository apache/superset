import React from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

const propTypes = {
  children: React.PropTypes.node,
  className: React.PropTypes.string,
  href: React.PropTypes.string,
  onClick: React.PropTypes.func,
  placement: React.PropTypes.string,
  style: React.PropTypes.object,
  tooltip: React.PropTypes.string,
};
const defaultProps = {
  className: '',
  href: '#',
  onClick: () => {},
  placement: 'top',
  style: {},
  tooltip: null,
};


class Link extends React.PureComponent {
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
Link.propTypes = propTypes;
Link.defaultProps = defaultProps;

export default Link;
