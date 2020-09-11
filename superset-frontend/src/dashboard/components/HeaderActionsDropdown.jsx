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

import { SupersetClient, t } from '@superset-ui/core';
import { DropdownButton, MenuItem } from 'react-bootstrap';

import Icon from 'src/components/Icon';

import CssEditor from './CssEditor';
import RefreshIntervalModal from './RefreshIntervalModal';
import SaveModal from './SaveModal';
import injectCustomCss from '../util/injectCustomCss';
import { SAVE_TYPE_NEWDASHBOARD } from '../util/constants';
import URLShortLinkModal from '../../components/URLShortLinkModal';
import FilterScopeModal from './filterscope/FilterScopeModal';
import downloadAsImage from '../../utils/downloadAsImage';
import getDashboardUrl from '../util/getDashboardUrl';
import { getActiveFilters } from '../util/activeDashboardFilters';

const propTypes = {
  addSuccessToast: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  dashboardInfo: PropTypes.object.isRequired,
  dashboardId: PropTypes.number.isRequired,
  dashboardTitle: PropTypes.string.isRequired,
  customCss: PropTypes.string.isRequired,
  colorNamespace: PropTypes.string,
  colorScheme: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  updateCss: PropTypes.func.isRequired,
  forceRefreshAllCharts: PropTypes.func.isRequired,
  refreshFrequency: PropTypes.number.isRequired,
  shouldPersistRefreshFrequency: PropTypes.bool.isRequired,
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
  refreshLimit: PropTypes.number,
  refreshWarning: PropTypes.string,
};

const defaultProps = {
  colorNamespace: undefined,
  colorScheme: undefined,
  refreshLimit: 0,
  refreshWarning: null,
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
      dashboardInfo,
      forceRefreshAllCharts,
      refreshFrequency,
      shouldPersistRefreshFrequency,
      editMode,
      customCss,
      colorNamespace,
      colorScheme,
      layout,
      expandedSlices,
      onSave,
      userCanEdit,
      userCanSave,
      isLoading,
      refreshLimit,
      refreshWarning,
    } = this.props;

    const emailTitle = t('Superset Dashboard');
    const emailSubject = `${emailTitle} ${dashboardTitle}`;
    const emailBody = t('Check out this dashboard: ');

    return (
      <DropdownButton
        title={<Icon name="more" />}
        noCaret
        id="save-dash-split-button"
        bsSize="small"
        style={{ border: 'none', padding: 0, marginLeft: '4px' }}
        pullRight
      >
        {userCanSave && (
          <>
            <SaveModal
              addSuccessToast={this.props.addSuccessToast}
              addDangerToast={this.props.addDangerToast}
              dashboardId={dashboardId}
              dashboardTitle={dashboardTitle}
              dashboardInfo={dashboardInfo}
              saveType={SAVE_TYPE_NEWDASHBOARD}
              layout={layout}
              expandedSlices={expandedSlices}
              refreshFrequency={refreshFrequency}
              shouldPersistRefreshFrequency={shouldPersistRefreshFrequency}
              customCss={customCss}
              colorNamespace={colorNamespace}
              colorScheme={colorScheme}
              onSave={onSave}
              isMenuItem
              triggerNode={<span>{t('Save as')}</span>}
              canOverwrite={userCanEdit}
            />
          </>
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
        <MenuItem onClick={forceRefreshAllCharts} disabled={isLoading}>
          {t('Refresh dashboard')}
        </MenuItem>
        <MenuItem divider />
        <RefreshIntervalModal
          refreshFrequency={refreshFrequency}
          refreshLimit={refreshLimit}
          refreshWarning={refreshWarning}
          onChange={this.changeRefreshInterval}
          editMode={editMode}
          triggerNode={<span>{t('Set auto-refresh interval')}</span>}
        />

        {editMode && (
          <>
            <FilterScopeModal
              className="m-r-5"
              triggerNode={
                <MenuItem bsSize="small">{t('Set filter mapping')}</MenuItem>
              }
            />
            <MenuItem onClick={this.props.showPropertiesModal}>
              {t('Edit dashboard properties')}
            </MenuItem>
            <CssEditor
              triggerNode={<span>{t('Edit CSS')}</span>}
              initialCss={this.state.css}
              templates={this.state.cssTemplates}
              onChange={this.changeCss}
            />
          </>
        )}

        {!editMode && (
          <MenuItem onClick={downloadAsImage('.dashboard', dashboardTitle)}>
            {t('Download as image')}
          </MenuItem>
        )}

        {!editMode && (
          <MenuItem
            onClick={() => {
              const hasStandalone = window.location.search.includes(
                'standalone=true',
              );
              const url = getDashboardUrl(
                window.location.pathname,
                getActiveFilters(),
                window.location.hash,
                !hasStandalone,
              );
              window.location.replace(url);
            }}
          >
            {t('Toggle FullScreen')}
          </MenuItem>
        )}
      </DropdownButton>
    );
  }
}

HeaderActionsDropdown.propTypes = propTypes;
HeaderActionsDropdown.defaultProps = defaultProps;

export default HeaderActionsDropdown;
