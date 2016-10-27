import React, { PropTypes } from 'react';
import { Panel, Tooltip, OverlayTrigger } from 'react-bootstrap';
import FieldSet from './FieldSet';

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
          {tooltip &&
            <OverlayTrigger
              placement="right"
              overlay={<Tooltip id={`${label}-tooltip`}>{tooltip}</Tooltip>}
            >
              <i className="fa fa-question-circle-o" />
            </OverlayTrigger>
          }
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

