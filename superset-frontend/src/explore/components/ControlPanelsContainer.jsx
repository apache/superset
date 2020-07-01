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
import { isPlainObject } from 'lodash';
import { t } from '@superset-ui/translation';
import { getChartControlPanelRegistry } from '@superset-ui/chart';
import { sharedControls } from '@superset-ui/chart-controls';

import ControlPanelSection from './ControlPanelSection';
import ControlRow from './ControlRow';
import Control from './Control';
import { sectionsToRender } from '../controlUtils';
import * as exploreActions from '../actions/exploreActions';

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
    this.renderControl = this.renderControl.bind(this);
    this.renderControlPanelSection = this.renderControlPanelSection.bind(this);
  }

  sectionsToRender() {
    return sectionsToRender(
      this.props.form_data.viz_type,
      this.props.datasource_type,
    );
  }

  removeAlert() {
    this.props.actions.removeControlPanelAlert();
  }

  renderControl({ name, config }) {
    const { actions, controls, exploreState, form_data: formData } = this.props;
    const { visibility } = config;
    // If the control item is not an object, we have to look up the control data from
    // the centralized controls file.
    // When it is an object we read control data straight from `config` instead
    const controlData = {
      ...controls[name],
      ...config,
      name,
      // apply current value in formData
      value: formData[name],
    };
    const {
      validationErrors,
      provideFormDataToProps,
      ...restProps
    } = controlData;

    // if visibility check says the config is not visible, don't render it
    if (visibility && !visibility.call(config, this.props, controlData)) {
      return null;
    }

    return (
      <Control
        name={name}
        key={`control-${name}`}
        validationErrors={validationErrors}
        actions={actions}
        formData={provideFormDataToProps ? formData : null}
        {...restProps}
      />
    );
  }

  renderControlPanelSection(section) {
    const { controls } = this.props;

    const hasErrors = section.controlSetRows.some(rows =>
      rows.some(
        s =>
          controls[s] &&
          controls[s].validationErrors &&
          controls[s].validationErrors.length > 0,
      ),
    );

    return (
      <ControlPanelSection
        key={section.label}
        label={section.label}
        startExpanded={section.expanded}
        hasErrors={hasErrors}
        description={section.description}
      >
        {section.controlSetRows.map((controlSets, i) => {
          const renderedControls = controlSets
            .map(controlItem => {
              if (!controlItem) {
                // When the item is invalid
                return null;
              } else if (React.isValidElement(controlItem)) {
                // When the item is a React element
                return controlItem;
              } else if (controlItem.name && controlItem.config) {
                return this.renderControl(controlItem);
              }
              return null;
            })
            .filter(x => x !== null);
          // don't show the row if it is empty
          if (renderedControls.length === 0) {
            return null;
          }
          return (
            <ControlRow
              key={`controlsetrow-${i}`}
              className="control-row"
              controls={renderedControls}
            />
          );
        })}
      </ControlPanelSection>
    );
  }
  render() {
    const querySectionsToRender = [];
    const displaySectionsToRender = [];
    this.sectionsToRender().forEach(section => {
      // if at least one control in the section is not `renderTrigger`
      // or asks to be displayed at the Data tab
      if (
        section.tabOverride === 'data' ||
        section.controlSetRows.some(rows =>
          rows.some(
            control =>
              control &&
              control.config &&
              (!control.config.renderTrigger ||
                control.config.tabOverride === 'data'),
          ),
        )
      ) {
        querySectionsToRender.push(section);
      } else {
        displaySectionsToRender.push(section);
      }
    });

    return (
      <div className="scrollbar-container">
        <div className="scrollbar-content">
          {this.props.alert && (
            <Alert bsStyle="warning">
              {this.props.alert}
              <i
                className="fa fa-close pull-right"
                onClick={this.removeAlert}
                style={{ cursor: 'pointer' }}
              />
            </Alert>
          )}
          <Tabs id="controlSections">
            <Tab eventKey="query" title={t('Data')}>
              {querySectionsToRender.map(this.renderControlPanelSection)}
            </Tab>
            {displaySectionsToRender.length > 0 && (
              <Tab eventKey="display" title={t('Customize')}>
                {displaySectionsToRender.map(this.renderControlPanelSection)}
              </Tab>
            )}
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
    actions: bindActionCreators(exploreActions, dispatch),
  };
}

export { ControlPanelsContainer };

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(ControlPanelsContainer);
