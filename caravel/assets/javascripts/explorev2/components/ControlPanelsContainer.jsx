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
  const wrapperDivStyle = {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    height: '100%',
  };

  const innerDivStyle = {
    position: 'absolute',
    top: '0px',
    left: '0px',
    right: '0px',
    bottom: '0px',
    overflow: 'scroll',
    marginRight: '0px',
    marginBottom: '0px',
  };
  return (
    <Panel>
      <div style={wrapperDivStyle}>
        <div style={innerDivStyle}>
          <div className="panel-body" style={{ marginBottom: '100px' }}>
            {DefaultControls}
            {VIZ_CONTROL_MAPPING[props.vizType]}
          </div>
        </div>
      </div>
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
