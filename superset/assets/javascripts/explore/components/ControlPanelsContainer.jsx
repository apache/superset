/* eslint camelcase: 0 */
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Alert } from 'react-bootstrap';
import visTypes, { sectionsToRender } from '../stores/visTypes';
import ControlPanelSection from './ControlPanelSection';
import ControlRow from './ControlRow';
import Control from './Control';
import controls from '../stores/controls';
import * as actions from '../actions/exploreActions';

const propTypes = {
  actions: PropTypes.object.isRequired,
  alert: PropTypes.string,
  datasource_type: PropTypes.string.isRequired,
  exploreState: PropTypes.object.isRequired,
  controls: PropTypes.object.isRequired,
  form_data: PropTypes.object.isRequired,
  isDatasourceMetaLoading: PropTypes.bool.isRequired,
};

class ControlPanelsContainer extends React.Component {
  constructor(props) {
    super(props);
    this.removeAlert = this.removeAlert.bind(this);
    this.getControlData = this.getControlData.bind(this);
  }
  getControlData(controlName) {
    const control = this.props.controls[controlName];
    // Identifying mapStateToProps function to apply (logic can't be in store)
    let mapF = controls[controlName].mapStateToProps;

    // Looking to find mapStateToProps override for this viz type
    const controlOverrides = visTypes[this.props.controls.viz_type.value].controlOverrides || {};
    if (controlOverrides[controlName] && controlOverrides[controlName].mapStateToProps) {
      mapF = controlOverrides[controlName].mapStateToProps;
    }
    // Applying mapStateToProps if needed
    if (mapF) {
      return Object.assign({}, control, mapF(this.props.exploreState, control));
    }
    return control;
  }
  sectionsToRender() {
    return sectionsToRender(this.props.form_data.viz_type, this.props.datasource_type);
  }
  removeAlert() {
    this.props.actions.removeControlPanelAlert();
  }
  render() {
    const ctrls = this.props.controls;
    return (
      <div className="scrollbar-container">
        <div className="scrollbar-content">
          {this.props.alert &&
            <Alert bsStyle="warning">
              {this.props.alert}
              <i
                className="fa fa-close pull-right"
                onClick={this.removeAlert}
                style={{ cursor: 'pointer' }}
              />
            </Alert>
          }
          {this.sectionsToRender().map((section) => {
            const hasErrors = section.controlSetRows.some(rows => rows.some(s => (
                ctrls[s] &&
                ctrls[s].validationErrors &&
                (ctrls[s].validationErrors.length > 0)
            )));
            return (
              <ControlPanelSection
                key={section.label}
                label={section.label}
                startExpanded={section.expanded}
                hasErrors={hasErrors}
                description={section.description}
              >
                {section.controlSetRows.map((controlSets, i) => (
                  <ControlRow
                    key={`controlsetrow-${i}`}
                    className="control-row"
                    controls={controlSets.map(controlName => (
                      controlName &&
                      ctrls[controlName] &&
                        <Control
                          name={controlName}
                          key={`control-${controlName}`}
                          value={this.props.form_data[controlName]}
                          validationErrors={ctrls[controlName].validationErrors}
                          actions={this.props.actions}
                          {...this.getControlData(controlName)}
                        />
                    ))}
                  />
                ))}
              </ControlPanelSection>);
          })}
        </div>
      </div>
    );
  }
}

ControlPanelsContainer.propTypes = propTypes;

function mapStateToProps({ explore }) {
  return {
    alert: explore.controlPanelAlert,
    isDatasourceMetaLoading: explore.isDatasourceMetaLoading,
    controls: explore.controls,
    exploreState: explore,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export { ControlPanelsContainer };

export default connect(mapStateToProps, mapDispatchToProps)(ControlPanelsContainer);
