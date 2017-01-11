import React, { PropTypes } from 'react';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';

const propTypes = {
  label: PropTypes.string,
  description: PropTypes.string,
  tooltip: PropTypes.string,
  children: PropTypes.node.isRequired,
};

const defaultProps = {
  label: null,
  description: null,
  tooltip: null,
};

export default class ControlPanelSection extends React.Component {
  renderHeader() {
    const { label, tooltip } = this.props;
    let header;
    if (label) {
      header = (
        <div>
          {label} &nbsp;
          {tooltip && <InfoTooltipWithTrigger label={label} tooltip={tooltip} />}
        </div>
      );
    }
    return header;
  }

  render() {
    return (
      <div className="panel panel-default control-panel-section">
        <div className="panel-header">
          <div className="panel-title">
            {this.renderHeader()}
          </div>
        </div>
        <div className="panel-body">
          {this.props.children}
        </div>
      </div>
    );
  }
}

ControlPanelSection.propTypes = propTypes;
ControlPanelSection.defaultProps = defaultProps;
