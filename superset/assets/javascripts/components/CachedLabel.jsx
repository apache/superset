import React from 'react';
import PropTypes from 'prop-types';
import { Label } from 'react-bootstrap';
import moment from 'moment';
import TooltipWrapper from './TooltipWrapper';

const propTypes = {
  onClick: PropTypes.func,
  cachedTimestamp: PropTypes.string,
  className: PropTypes.string,
};

class CacheLabel extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      tooltipContent: '',
      hovered: false,
    };
  }

  updateTooltipContent() {
    const cachedText = this.props.cachedTimestamp ? (
      <span>
        Loaded data cached <b>{moment.utc(this.props.cachedTimestamp).fromNow()}</b>
      </span>) :
      'Loaded from cache';

    const tooltipContent = (
      <span>
        {cachedText}.
        Click to force-refresh
      </span>
    );
    this.setState({ tooltipContent });
  }

  mouseOver() {
    this.updateTooltipContent();
    this.setState({ hovered: true });
  }

  mouseOut() {
    this.setState({ hovered: false });
  }

  render() {
    const labelStyle = this.state.hovered ? 'primary' : 'default';
    return (
      <TooltipWrapper
        tooltip={this.state.tooltipContent}
        label="cache-desc"
      >
        <Label
          className={this.props.className}
          bsStyle={labelStyle}
          style={{ fontSize: '10px', marginRight: '5px', cursor: 'pointer' }}
          onClick={this.props.onClick}
          onMouseOver={this.mouseOver.bind(this)}
          onMouseOut={this.mouseOut.bind(this)}
        >
          cached <i className="fa fa-refresh" />
        </Label>
      </TooltipWrapper>);
  }
}
CacheLabel.propTypes = propTypes;

export default CacheLabel;
