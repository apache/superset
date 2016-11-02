import React, { PropTypes } from 'react';
import { Panel } from 'react-bootstrap';
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
  header() {
    const { label, tooltip } = this.props;
    let header;
    if (label) {
      header = (
        <div className="panel-title">
          {label} &nbsp;
          {tooltip && <InfoTooltipWithTrigger label={label} tooltip={tooltip} />}
        </div>
      );
    }
    return header;
  }

  render() {
    return (
      <Panel header={this.header()}>
        {this.props.children}
      </Panel>
    );
  }
}

ControlPanelSection.propTypes = propTypes;
ControlPanelSection.defaultProps = defaultProps;
