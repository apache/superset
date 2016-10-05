import React from 'react';
import { connect } from 'react-redux';
import { Panel } from 'react-bootstrap';
import { DefaultControls, VIZ_CONTROL_MAPPING } from '../constants';

const propTypes = {
  vizType: React.PropTypes.string,
};

const defaultProps = {
  vizType: null,
};

function ControlPanelsContainer(props) {
  return (
    <Panel>
      {DefaultControls}
      {VIZ_CONTROL_MAPPING[props.vizType]}
    </Panel>
  );
}

ControlPanelsContainer.propTypes = propTypes;
ControlPanelsContainer.defaultProps = defaultProps;

function mapStateToProps(state) {
  return {
    vizType: state.vizType,
  };
}

function mapDispatchToProps() {
  return {};
}

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanelsContainer);
