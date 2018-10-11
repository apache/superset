import React from 'react';
import PropTypes from 'prop-types';
import { Label } from 'react-bootstrap';
import TooltipWrapper from './TooltipWrapper';

const propTypes = {
  onClick: PropTypes.func,
  className: PropTypes.string,
  tooltipContent: PropTypes.string.isRequired,
};

class RefreshLabel extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      hovered: false,
    };
  }

  mouseOver() {
    this.setState({ hovered: true });
  }

  mouseOut() {
    this.setState({ hovered: false });
  }

  render() {
    const labelStyle = this.state.hovered ? 'primary' : 'default';
    const tooltip = 'Click to ' + this.props.tooltipContent;
    return (
      <TooltipWrapper
        tooltip={tooltip}
        label="cache-desc"
      >
        <Label
          className={this.props.className}
          bsStyle={labelStyle}
          style={{ fontSize: '13px', marginRight: '5px', cursor: 'pointer' }}
          onClick={this.props.onClick}
          onMouseOver={this.mouseOver.bind(this)}
          onMouseOut={this.mouseOut.bind(this)}
        >
          <i className="fa fa-refresh" />
        </Label>
      </TooltipWrapper>);
  }
}
RefreshLabel.propTypes = propTypes;

export default RefreshLabel;
