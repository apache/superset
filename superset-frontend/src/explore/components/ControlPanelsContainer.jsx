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
import { Alert } from 'react-bootstrap';
import { css } from '@emotion/core';
import { t, styled } from '@superset-ui/core';

import Tabs from 'src/common/components/Tabs';
import ControlPanelSection from './ControlPanelSection';
import ControlRow from './ControlRow';
import Control from './Control';
import { sectionsToRender } from '../controlUtils';
import { exploreActions } from '../actions/exploreActions';

const propTypes = {
  actions: PropTypes.object.isRequired,
  alert: PropTypes.string,
  datasource_type: PropTypes.string.isRequired,
  exploreState: PropTypes.object.isRequired,
  controls: PropTypes.object.isRequired,
  form_data: PropTypes.object.isRequired,
  isDatasourceMetaLoading: PropTypes.bool.isRequired,
};

const Styles = styled.div`
  height: 100%;
  max-height: 100%;
  overflow: auto;
  .remove-alert {
    cursor: pointer;
  }
  #controlSections {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 100%;
  }
  .nav-tabs {
    flex: 0 0 1;
  }
  .tab-content {
    overflow: auto;
    flex: 1 1 100%;
  }
`;

const ControlPanelsTabs = styled(Tabs)`
  ${({ fullWidth }) =>
    css`
      .ant-tabs-nav-list {
        width: ${fullWidth ? '100%' : '50%'};
      }
    `}
`;

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
    const { actions, controls, form_data: formData } = this.props;
    const { visibility } = config;

    // If the control item is not an object, we have to look up the control data from
    // the centralized controls file.
    // When it is an object we read control data straight from `config` instead
    const controlData = {
      ...config,
      ...controls[name],
      name,
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
        key={`control-${name}`}
        name={name}
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
              }
              if (React.isValidElement(controlItem)) {
                // When the item is a React element
                return controlItem;
              }
              if (controlItem.name && controlItem.config) {
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

    const showCustomizeTab = displaySectionsToRender.length > 0;
    return (
      <Styles>
        {this.props.alert && (
          <Alert bsStyle="warning">
            {this.props.alert}
            <i
              role="button"
              aria-label="Remove alert"
              tabIndex={0}
              className="fa fa-close pull-right"
              onClick={this.removeAlert}
              style={{ cursor: 'pointer' }}
            />
          </Alert>
        )}
        <ControlPanelsTabs
          id="controlSections"
          data-test="control-tabs"
          fullWidth={showCustomizeTab}
        >
          <Tabs.TabPane key="query" tab={t('Data')}>
            {querySectionsToRender.map(this.renderControlPanelSection)}
          </Tabs.TabPane>
          {showCustomizeTab && (
            <Tabs.TabPane key="display" tab={t('Customize')}>
              {displaySectionsToRender.map(this.renderControlPanelSection)}
            </Tabs.TabPane>
          )}
        </ControlPanelsTabs>
      </Styles>
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
