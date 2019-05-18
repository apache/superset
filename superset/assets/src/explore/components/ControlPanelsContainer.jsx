/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint camelcase: 0 */
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Alert, Tab, Tabs } from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import controlPanelConfigs, { sectionsToRender } from '../controlPanels';
import ControlPanelSection from './ControlPanelSection';
import ControlRow from './ControlRow';
import Control from './Control';
import controls from '../controls';
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
    this.renderControlPanelSection = this.renderControlPanelSection.bind(this);
  }
  getControlData(controlName) {
    if (React.isValidElement(controlName)) {
      return controlName;
    }

    const control = this.props.controls[controlName];
    // Identifying mapStateToProps function to apply (logic can't be in store)
    let mapF = controls[controlName].mapStateToProps;

    // Looking to find mapStateToProps override for this viz type
    const config = controlPanelConfigs[this.props.controls.viz_type.value] || {};
    const controlOverrides = config.controlOverrides || {};
    if (controlOverrides[controlName] && controlOverrides[controlName].mapStateToProps) {
      mapF = controlOverrides[controlName].mapStateToProps;
    }
    // Applying mapStateToProps if needed
    if (mapF) {
      return Object.assign({}, control, mapF(this.props.exploreState, control, this.props.actions));
    }
    return control;
  }
  sectionsToRender() {
    return sectionsToRender(this.props.form_data.viz_type, this.props.datasource_type);
  }
  removeAlert() {
    this.props.actions.removeControlPanelAlert();
  }
  renderControlPanelSection(section) {
    const ctrls = this.props.controls;
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
            controls={controlSets.map((controlName) => {
              if (!controlName) {
                return null;
              } else if (React.isValidElement(controlName)) {
                return controlName;
              } else if (ctrls[controlName]) {
                return (<Control
                  name={controlName}
                  key={`control-${controlName}`}
                  value={this.props.form_data[controlName]}
                  validationErrors={ctrls[controlName].validationErrors}
                  actions={this.props.actions}
                  formData={ctrls[controlName].provideFormDataToProps ? this.props.form_data : null}
                  {...this.getControlData(controlName)}
                />);
              }
              return null;
            })}
          />
        ))}
      </ControlPanelSection>
    );
  }
  render() {
    const allSectionsToRender = this.sectionsToRender();
    const querySectionsToRender = [];
    const displaySectionsToRender = [];
    allSectionsToRender.forEach((section) => {
      if (section.controlSetRows.some(rows => rows.some(
        control => (
          controls[control] &&
          (
            !controls[control].renderTrigger ||
            controls[control].tabOverride === 'data'
          )
        )))) {
        querySectionsToRender.push(section);
      } else {
        displaySectionsToRender.push(section);
      }
    });

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
          <Tabs id="controlSections">
            <Tab eventKey="query" title={t('Data')}>
              {querySectionsToRender.map(this.renderControlPanelSection)}
            </Tab>
            {displaySectionsToRender.length > 0 &&
              <Tab eventKey="display" title={t('Customize')}>
                {displaySectionsToRender.map(this.renderControlPanelSection)}
              </Tab>
            }
          </Tabs>
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
