import React, { PropTypes } from 'react';
import { Panel } from 'react-bootstrap';
import FieldSet from './FieldSet';

const propTypes = {
  label: PropTypes.string,
  description: PropTypes.string,
}

export default class ControlPanelSection extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    {/* add tooltip if present to header, this.props.description */}
    const header = <div className="panel-title">{this.props.label}</div>;

    return (
      <Panel header={header}>
        {this.props.children}
      </Panel>
    );
  }
}

