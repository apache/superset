import React, { PropTypes } from 'react';
import { Panel } from 'react-bootstrap';
import FieldSet from './FieldSet';

const propTypes = {
  title: PropTypes.string,
  fieldSetNames: PropTypes.array,
  description: PropTypes.string,
}

export default class ControlPanelSection extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <Panel
          style={{ height: this.props.height }}
          header={<div className="panel-title">{this.props.label}</div>}
        >
        {this.props.children}
      </Panel>
    );
  }
}

