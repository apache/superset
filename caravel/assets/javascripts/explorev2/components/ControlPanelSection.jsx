import React, { PropTypes } from 'react';
import { Panel } from 'react-bootstrap';
import FieldSet from './FieldSet';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';

const propTypes = {
  label: PropTypes.string,
  description: PropTypes.string,
};

export default class ControlPanelSection extends React.Component {
  header() {
    const { label, tooltip } = this.props;
    if (label) {
      return (
        <div className="panel-title">
          {label} &nbsp;
          {tooltip && <InfoTooltipWithTrigger label={label} tooltip={tooltip} />}
        </div>
      );
    }
  }

  render() {
    return (
      <Panel header={this.header()}>
        {this.props.children}
      </Panel>
    );
  }
}

