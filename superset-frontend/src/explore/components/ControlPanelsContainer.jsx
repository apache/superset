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
import { t, styled, getChartControlPanelRegistry } from '@superset-ui/core';

import Tabs from 'src/common/components/Tabs';
import { Collapse } from 'src/common/components';
import { PluginContext } from 'src/components/DynamicPlugins';
import Loading from 'src/components/Loading';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
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
  width: 100%;
  overflow: auto;
  overflow-x: visible;
  overflow-y: auto;
  .remove-alert {
    cursor: pointer;
  }
  #controlSections {
    min-height: 100%;
    overflow: visible;
  }
  .nav-tabs {
    flex: 0 0 1;
  }
  .tab-content {
    overflow: auto;
    flex: 1 1 100%;
  }
  .Select__menu {
    max-width: 100%;
  }
`;

const ControlPanelsTabs = styled(Tabs)`
  .ant-tabs-nav-list {
    width: ${({ fullWidth }) => (fullWidth ? '100%' : '50%')};
  }
  .ant-tabs-content-holder {
    overflow: visible;
  }
  .ant-tabs-tabpane {
    height: 100%;
  }
`;
class ControlPanelsContainer extends React.Component {
  // trigger updates to the component when async plugins load
  static contextType = PluginContext;

  constructor(props) {
    super(props);

    this.removeAlert = this.removeAlert.bind(this);
    this.renderControl = this.renderControl.bind(this);
    this.renderControlPanelSection = this.renderControlPanelSection.bind(this);
  }

  componentDidUpdate(prevProps) {
    const {
      actions: { setControlValue },
    } = this.props;
    if (this.props.form_data.datasource !== prevProps.form_data.datasource) {
      const defaultValues = [
        'MetricsControl',
        'AdhocFilterControl',
        'TextControl',
        'SelectControl',
        'CheckboxControl',
        'AnnotationLayerControl',
      ];
      Object.entries(this.props.controls).forEach(([controlName, control]) => {
        const { type, default: defaultValue } = control;
        if (defaultValues.includes(type)) {
          setControlValue(controlName, defaultValue);
        }
      });
    }
  }

  sectionsToRender() {
    return sectionsToRender(
      this.props.form_data.viz_type,
      this.props.datasource_type,
    );
  }

  sectionsToExpand(sections) {
    return sections.reduce(
      (acc, cur) => (cur.expanded ? [...acc, cur.label] : acc),
      [],
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
        datasource={formData?.datasource}
        {...restProps}
      />
    );
  }

  renderControlPanelSection(section) {
    const { controls } = this.props;
    const { label, description } = section;

    const hasErrors = section.controlSetRows.some(rows =>
      rows.some(
        s =>
          controls[s] &&
          controls[s].validationErrors &&
          controls[s].validationErrors.length > 0,
      ),
    );
    const PanelHeader = () => (
      <span>
        <span>{label}</span>{' '}
        {description && (
          <InfoTooltipWithTrigger label={label} tooltip={description} />
        )}
        {hasErrors && (
          <InfoTooltipWithTrigger
            label="validation-errors"
            bsStyle="danger"
            tooltip="This section contains validation errors"
          />
        )}
      </span>
    );

    return (
      <Collapse.Panel
        className="control-panel-section"
        header={PanelHeader()}
        key={section.label}
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
              if (
                controlItem.name &&
                controlItem.config &&
                controlItem.name !== 'datasource'
              ) {
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
      </Collapse.Panel>
    );
  }

  render() {
    const controlPanelRegistry = getChartControlPanelRegistry();
    if (
      !controlPanelRegistry.has(this.props.form_data.viz_type) &&
      this.context.loading
    ) {
      return <Loading />;
    }

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
    const expandedQuerySections = this.sectionsToExpand(querySectionsToRender);
    const expandedCustomSections = this.sectionsToExpand(
      displaySectionsToRender,
    );
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
            <Collapse
              bordered
              defaultActiveKey={expandedQuerySections}
              expandIconPosition="right"
              ghost
            >
              {querySectionsToRender.map(this.renderControlPanelSection)}
            </Collapse>
          </Tabs.TabPane>
          {showCustomizeTab && (
            <Tabs.TabPane key="display" tab={t('Customize')}>
              <Collapse
                bordered
                defaultActiveKey={expandedCustomSections}
                expandIconPosition="right"
                ghost
              >
                {displaySectionsToRender.map(this.renderControlPanelSection)}
              </Collapse>
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
