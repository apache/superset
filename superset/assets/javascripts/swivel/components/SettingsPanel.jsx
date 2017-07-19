import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Panel, Checkbox } from 'react-bootstrap';
import { toggleShowLegend } from '../actions/vizSettingsActions';

const propTypes = {
  showLegend: PropTypes.bool,
  toggleLegend: PropTypes.func,
};

class SettingsPanel extends PureComponent {
  render() {
    const { showLegend, toggleLegend } = this.props;
    return (
      <Panel header="Visualization Settings">
        <Checkbox
          checked={showLegend}
          onChange={toggleLegend}
        >Show Legend</Checkbox>
      </Panel>
    );
  }
}

SettingsPanel.propTypes = propTypes;

const mapStateToProps = state => ({
  showLegend: state.settings.present.viz.showLegend,
});

const mapDispatchToProps = dispatch => ({
  toggleLegend: () => dispatch(toggleShowLegend()),
});

export default connect(mapStateToProps, mapDispatchToProps)(SettingsPanel);
