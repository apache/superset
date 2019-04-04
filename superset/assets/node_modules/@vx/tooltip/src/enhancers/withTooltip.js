import React from 'react';
import PropTypes from 'prop-types';

export const withTooltipPropTypes = {
  tooltipOpen: PropTypes.bool,
  tooltipLeft: PropTypes.number,
  tooltipTop: PropTypes.number,
  tooltipData: PropTypes.object,
  updateTooltip: PropTypes.func,
  showTooltip: PropTypes.func,
  hideTooltip: PropTypes.func,
};

export default function withTooltip(BaseComponent) {
  class WrappedComponent extends React.PureComponent {
    constructor(props) {
      super(props);
      this.state = {
        tooltipOpen: false,
        tooltipLeft: undefined,
        tooltipTop: undefined,
        tooltipData: undefined
      };
      this.updateTooltip = this.updateTooltip.bind(this);
      this.showTooltip = this.showTooltip.bind(this);
      this.hideTooltip = this.hideTooltip.bind(this);
    }
    updateTooltip({ tooltipOpen, tooltipLeft, tooltipTop, tooltipData }) {
      this.setState(prevState => ({
        ...prevState,
        tooltipOpen,
        tooltipLeft,
        tooltipTop,
        tooltipData
      }));
    }
    showTooltip({ tooltipLeft, tooltipTop, tooltipData }) {
      this.updateTooltip({
        tooltipOpen: true,
        tooltipLeft,
        tooltipTop,
        tooltipData
      });
    }
    hideTooltip() {
      this.updateTooltip({
        tooltipOpen: false,
        tooltipLeft: undefined,
        tooltipTop: undefined,
        tooltipData: undefined
      });
    }
    render() {
      return (
        <div style={{ position: 'relative' }}>
          <BaseComponent
            updateTooltip={this.updateTooltip}
            showTooltip={this.showTooltip}
            hideTooltip={this.hideTooltip}
            {...this.state}
            {...this.props}
          />
        </div>
      );
    }
  }
  return WrappedComponent;
}
