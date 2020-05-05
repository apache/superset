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
import React from 'react';
import PropTypes from 'prop-types';
import { SupersetClient } from '@superset-ui/connection';
import { DropdownButton, MenuItem } from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import CssEditor from './CssEditor';
import RefreshIntervalModal from './RefreshIntervalModal';
import SaveModal from './SaveModal';
import injectCustomCss from '../util/injectCustomCss';
import { SAVE_TYPE_NEWDASHBOARD } from '../util/constants';
import URLShortLinkModal from '../../components/URLShortLinkModal';
import getDashboardUrl from '../util/getDashboardUrl';
import { getActiveFilters } from '../util/activeDashboardFilters';

const propTypes = {
  addSuccessToast: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  dashboardId: PropTypes.number.isRequired,
  dashboardTitle: PropTypes.string.isRequired,
  hasUnsavedChanges: PropTypes.bool.isRequired,
  customCss: PropTypes.string.isRequired,
  colorNamespace: PropTypes.string,
  colorScheme: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  updateCss: PropTypes.func.isRequired,
  forceRefreshAllCharts: PropTypes.func.isRequired,
  refreshFrequency: PropTypes.number.isRequired,
  setRefreshFrequency: PropTypes.func.isRequired,
  startPeriodicRender: PropTypes.func.isRequired,
  editMode: PropTypes.bool.isRequired,
  userCanEdit: PropTypes.bool.isRequired,
  userCanSave: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool.isRequired,
  layout: PropTypes.object.isRequired,
  expandedSlices: PropTypes.object.isRequired,
  onSave: PropTypes.func.isRequired,
  showPropertiesModal: PropTypes.func.isRequired,
};

const defaultProps = {
  colorNamespace: undefined,
  colorScheme: undefined,
};

class HeaderActionsDropdown extends React.PureComponent {
  static discardChanges() {
    window.location.reload();
  }

  constructor(props) {
    super(props);
    this.state = {
      css: props.customCss,
      cssTemplates: [],
    };

    this.changeCss = this.changeCss.bind(this);
    this.changeRefreshInterval = this.changeRefreshInterval.bind(this);
  }

  UNSAFE_componentWillMount() {
    injectCustomCss(this.state.css);

    SupersetClient.get({ endpoint: '/csstemplateasyncmodelview/api/read' })
      .then(({ json }) => {
        const cssTemplates = json.result.map(row => ({
          value: row.template_name,
          css: row.css,
          label: row.template_name,
        }));
        this.setState({ cssTemplates });
      })
      .catch(() => {
        this.props.addDangerToast(
          t('An error occurred while fetching available CSS templates'),
        );
      });
  }

  changeCss(css) {
    this.setState({ css }, () => {
      injectCustomCss(css);
    });
    this.props.onChange();
    this.props.updateCss(css);
  }

  changeRefreshInterval(refreshInterval, isPersistent) {
    this.props.setRefreshFrequency(refreshInterval, isPersistent);
    this.props.startPeriodicRender(refreshInterval * 1000);
  }

  render() {
    const {
      dashboardTitle,
      dashboardId,
      forceRefreshAllCharts,
      refreshFrequency,
      editMode,
      customCss,
      colorNamespace,
      colorScheme,
      hasUnsavedChanges,
      layout,
      expandedSlices,
      onSave,
      userCanEdit,
      userCanSave,
      isLoading,
    } = this.props;

    const emailTitle = t('Superset Dashboard');
    const emailSubject = `${emailTitle} ${dashboardTitle}`;
    const emailBody = t('Check out this dashboard: ');

    return (
      <DropdownButton
        title=""
        id="save-dash-split-button"
        bsStyle={hasUnsavedChanges ? 'primary' : undefined}
        bsSize="small"
        pullRight
      >
        {userCanSave && (
          <SaveModal
            addSuccessToast={this.props.addSuccessToast}
            addDangerToast={this.props.addDangerToast}
            dashboardId={dashboardId}
            dashboardTitle={dashboardTitle}
            saveType={SAVE_TYPE_NEWDASHBOARD}
            layout={layout}
            expandedSlices={expandedSlices}
            refreshFrequency={refreshFrequency}
            customCss={customCss}
            colorNamespace={colorNamespace}
            colorScheme={colorScheme}
            onSave={onSave}
            isMenuItem
            triggerNode={<span>{t('Save as')}</span>}
            canOverwrite={userCanEdit}
          />
        )}

        {hasUnsavedChanges && userCanSave && (
          <div>
            <MenuItem
              eventKey="discard"
              onSelect={HeaderActionsDropdown.discardChanges}
            >
              {t('Discard changes')}
            </MenuItem>
          </div>
        )}

        {userCanSave && <MenuItem divider />}

        <MenuItem onClick={forceRefreshAllCharts} disabled={isLoading}>
          {t('Force refresh dashboard')}
        </MenuItem>

        <RefreshIntervalModal
          refreshFrequency={refreshFrequency}
          onChange={this.changeRefreshInterval}
          editMode={editMode}
          triggerNode={
            <span>
              {editMode
                ? t('Set auto-refresh interval')
                : t('Auto-refresh dashboard')}
            </span>
          }
        />

        {editMode && (
          <MenuItem onClick={this.props.showPropertiesModal}>
            {t('Edit dashboard properties')}
          </MenuItem>
        )}

        <URLShortLinkModal
          url={getDashboardUrl(
            window.location.pathname,
            getActiveFilters(),
            window.location.hash,
          )}
          emailSubject={emailSubject}
          emailContent={emailBody}
          addDangerToast={this.props.addDangerToast}
          isMenuItem
          triggerNode={<span>{t('Share dashboard')}</span>}
        />

        {editMode && (
          <CssEditor
            triggerNode={<span>{t('Edit CSS')}</span>}
            initialCss={this.state.css}
            templates={this.state.cssTemplates}
            onChange={this.changeCss}
          />
        )}
      </DropdownButton>
    );
  }
}

HeaderActionsDropdown.propTypes = propTypes;
HeaderActionsDropdown.defaultProps = defaultProps;

export default HeaderActionsDropdown;
