import React from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

const propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  href: PropTypes.string,
  onClick: PropTypes.func,
  placement: PropTypes.string,
  style: PropTypes.object,
  tooltip: PropTypes.string,
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
    const tooltip = (
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
