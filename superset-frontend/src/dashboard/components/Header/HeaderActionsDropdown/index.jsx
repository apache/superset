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
import { isEmpty } from 'lodash';
import {
  isFeatureEnabled,
  FeatureFlag,
  SupersetClient,
  t,
} from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import { URL_PARAMS } from 'src/constants';
import ShareMenuItems from 'src/dashboard/components/menu/ShareMenuItems';
import DownloadMenuItems from 'src/dashboard/components/menu/DownloadMenuItems';
import CssEditor from 'src/dashboard/components/CssEditor';
import RefreshIntervalModal from 'src/dashboard/components/RefreshIntervalModal';
import SaveModal from 'src/dashboard/components/SaveModal';
import HeaderReportDropdown from 'src/features/reports/ReportModal/HeaderReportDropdown';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';
import { SAVE_TYPE_NEWDASHBOARD } from 'src/dashboard/util/constants';
import FilterScopeModal from 'src/dashboard/components/filterscope/FilterScopeModal';
import getDashboardUrl from 'src/dashboard/util/getDashboardUrl';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { getUrlParam } from 'src/utils/urlUtils';

const propTypes = {
  addSuccessToast: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  dashboardInfo: PropTypes.object.isRequired,
  dashboardId: PropTypes.number,
  dashboardTitle: PropTypes.string,
  dataMask: PropTypes.object.isRequired,
  customCss: PropTypes.string,
  colorNamespace: PropTypes.string,
  colorScheme: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  updateCss: PropTypes.func.isRequired,
  forceRefreshAllCharts: PropTypes.func.isRequired,
  refreshFrequency: PropTypes.number,
  shouldPersistRefreshFrequency: PropTypes.bool.isRequired,
  setRefreshFrequency: PropTypes.func.isRequired,
  startPeriodicRender: PropTypes.func.isRequired,
  editMode: PropTypes.bool.isRequired,
  userCanEdit: PropTypes.bool,
  userCanShare: PropTypes.bool,
  userCanSave: PropTypes.bool,
  userCanCurate: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool.isRequired,
  layout: PropTypes.object.isRequired,
  expandedSlices: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  showPropertiesModal: PropTypes.func.isRequired,
  manageEmbedded: PropTypes.func.isRequired,
  logEvent: PropTypes.func,
  refreshLimit: PropTypes.number,
  refreshWarning: PropTypes.string,
  lastModifiedTime: PropTypes.number.isRequired,
};

const defaultProps = {
  colorNamespace: undefined,
  colorScheme: undefined,
  refreshLimit: 0,
  refreshWarning: null,
};

const MENU_KEYS = {
  SAVE_MODAL: 'save-modal',
  SHARE_DASHBOARD: 'share-dashboard',
  REFRESH_DASHBOARD: 'refresh-dashboard',
  AUTOREFRESH_MODAL: 'autorefresh-modal',
  SET_FILTER_MAPPING: 'set-filter-mapping',
  EDIT_PROPERTIES: 'edit-properties',
  EDIT_CSS: 'edit-css',
  DOWNLOAD_DASHBOARD: 'download-dashboard',
  TOGGLE_FULLSCREEN: 'toggle-fullscreen',
  MANAGE_EMBEDDED: 'manage-embedded',
  MANAGE_EMAIL_REPORT: 'manage-email-report',
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
      showReportSubMenu: null,
    };

    this.changeCss = this.changeCss.bind(this);
    this.changeRefreshInterval = this.changeRefreshInterval.bind(this);
    this.handleMenuClick = this.handleMenuClick.bind(this);
    this.setShowReportSubMenu = this.setShowReportSubMenu.bind(this);
  }

  UNSAFE_componentWillMount() {
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

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.props.customCss !== nextProps.customCss) {
      this.setState({ css: nextProps.customCss }, () => {
        injectCustomCss(nextProps.customCss);
      });
    }
  }

  setShowReportSubMenu(show) {
    this.setState({
      showReportSubMenu: show,
    });
  }

  changeCss(css) {
    this.props.onChange();
    this.props.updateCss(css);
  }

  changeRefreshInterval(refreshInterval, isPersistent) {
    this.props.setRefreshFrequency(refreshInterval, isPersistent);
    this.props.startPeriodicRender(refreshInterval * 1000);
  }

  handleMenuClick({ key }) {
    switch (key) {
      case MENU_KEYS.REFRESH_DASHBOARD:
        this.props.forceRefreshAllCharts();
        this.props.addSuccessToast(t('Refreshing charts'));
        break;
      case MENU_KEYS.EDIT_PROPERTIES:
        this.props.showPropertiesModal();
        break;
      case MENU_KEYS.TOGGLE_FULLSCREEN: {
        const url = getDashboardUrl({
          pathname: window.location.pathname,
          filters: getActiveFilters(),
          hash: window.location.hash,
          standalone: !getUrlParam(URL_PARAMS.standalone),
        });
        window.location.replace(url);
        break;
      }
      case MENU_KEYS.MANAGE_EMBEDDED: {
        this.props.manageEmbedded();
        break;
      }
      default:
        break;
    }
  }

  render() {
    const {
      dashboardTitle,
      dashboardId,
      dashboardInfo,
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
      userCanShare,
      userCanSave,
      userCanCurate,
      isLoading,
      refreshLimit,
      refreshWarning,
      lastModifiedTime,
      addSuccessToast,
      addDangerToast,
      setIsDropdownVisible,
      isDropdownVisible,
      ...rest
    } = this.props;

    const emailTitle = t('Superset dashboard');
    const emailSubject = `${emailTitle} ${dashboardTitle}`;
    const emailBody = t('Check out this dashboard: ');

    const isEmbedded = !dashboardInfo?.userId;

    const url = getDashboardUrl({
      pathname: window.location.pathname,
      filters: getActiveFilters(),
      hash: window.location.hash,
    });

    const refreshIntervalOptions =
      dashboardInfo.common?.conf?.DASHBOARD_AUTO_REFRESH_INTERVALS;

    return (
      <Menu selectable={false} data-test="header-actions-menu" {...rest}>
        {!editMode && (
          <Menu.Item
            key={MENU_KEYS.REFRESH_DASHBOARD}
            data-test="refresh-dashboard-menu-item"
            disabled={isLoading}
            onClick={this.handleMenuClick}
          >
            {t('Refresh dashboard')}
          </Menu.Item>
        )}
        {!editMode && !isEmbedded && (
          <Menu.Item
            key={MENU_KEYS.TOGGLE_FULLSCREEN}
            onClick={this.handleMenuClick}
          >
            {getUrlParam(URL_PARAMS.standalone)
              ? t('Exit fullscreen')
              : t('Enter fullscreen')}
          </Menu.Item>
        )}
        {editMode && (
          <Menu.Item
            key={MENU_KEYS.EDIT_PROPERTIES}
            onClick={this.handleMenuClick}
          >
            {t('Edit properties')}
          </Menu.Item>
        )}
        {editMode && (
          <Menu.Item key={MENU_KEYS.EDIT_CSS}>
            <CssEditor
              triggerNode={<span>{t('Edit CSS')}</span>}
              initialCss={this.state.css}
              templates={this.state.cssTemplates}
              onChange={this.changeCss}
            />
          </Menu.Item>
        )}
        <Menu.Divider />
        {userCanSave && (
          <Menu.Item key={MENU_KEYS.SAVE_MODAL}>
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
              lastModifiedTime={lastModifiedTime}
              customCss={customCss}
              colorNamespace={colorNamespace}
              colorScheme={colorScheme}
              onSave={onSave}
              triggerNode={
                <span data-test="save-as-menu-item">{t('Save as')}</span>
              }
              canOverwrite={userCanEdit}
            />
          </Menu.Item>
        )}
        <Menu.SubMenu
          key={MENU_KEYS.DOWNLOAD_DASHBOARD}
          disabled={isLoading}
          title={t('Download')}
          logEvent={this.props.logEvent}
        >
          <DownloadMenuItems
            pdfMenuItemTitle={t('Export to PDF')}
            imageMenuItemTitle={t('Download as Image')}
            dashboardTitle={dashboardTitle}
            addDangerToast={addDangerToast}
          />
        </Menu.SubMenu>
        {userCanShare && (
          <Menu.SubMenu
            key={MENU_KEYS.SHARE_DASHBOARD}
            data-test="share-dashboard-menu-item"
            disabled={isLoading}
            title={t('Share')}
          >
            <ShareMenuItems
              url={url}
              copyMenuItemTitle={t('Copy permalink to clipboard')}
              emailMenuItemTitle={t('Share permalink by email')}
              emailSubject={emailSubject}
              emailBody={emailBody}
              addSuccessToast={addSuccessToast}
              addDangerToast={addDangerToast}
              dashboardId={dashboardId}
            />
          </Menu.SubMenu>
        )}
        {!editMode && userCanCurate && (
          <Menu.Item
            key={MENU_KEYS.MANAGE_EMBEDDED}
            onClick={this.handleMenuClick}
          >
            {t('Embed dashboard')}
          </Menu.Item>
        )}
        <Menu.Divider />
        {!editMode ? (
          this.state.showReportSubMenu ? (
            <>
              <Menu.SubMenu title={t('Manage email report')}>
                <HeaderReportDropdown
                  dashboardId={dashboardInfo.id}
                  setShowReportSubMenu={this.setShowReportSubMenu}
                  showReportSubMenu={this.state.showReportSubMenu}
                  setIsDropdownVisible={setIsDropdownVisible}
                  isDropdownVisible={isDropdownVisible}
                  useTextMenu
                />
              </Menu.SubMenu>
              <Menu.Divider />
            </>
          ) : (
            <Menu>
              <HeaderReportDropdown
                dashboardId={dashboardInfo.id}
                setShowReportSubMenu={this.setShowReportSubMenu}
                setIsDropdownVisible={setIsDropdownVisible}
                isDropdownVisible={isDropdownVisible}
                useTextMenu
              />
            </Menu>
          )
        ) : null}
        {editMode &&
          !(
            isFeatureEnabled(FeatureFlag.DASHBOARD_NATIVE_FILTERS) &&
            isEmpty(dashboardInfo?.metadata?.filter_scopes)
          ) && (
            <Menu.Item key={MENU_KEYS.SET_FILTER_MAPPING}>
              <FilterScopeModal
                className="m-r-5"
                triggerNode={t('Set filter mapping')}
              />
            </Menu.Item>
          )}

        <Menu.Item key={MENU_KEYS.AUTOREFRESH_MODAL}>
          <RefreshIntervalModal
            addSuccessToast={this.props.addSuccessToast}
            refreshFrequency={refreshFrequency}
            refreshLimit={refreshLimit}
            refreshWarning={refreshWarning}
            onChange={this.changeRefreshInterval}
            editMode={editMode}
            refreshIntervalOptions={refreshIntervalOptions}
            triggerNode={<span>{t('Set auto-refresh interval')}</span>}
          />
        </Menu.Item>
      </Menu>
    );
  }
}

HeaderActionsDropdown.propTypes = propTypes;
HeaderActionsDropdown.defaultProps = defaultProps;

export default HeaderActionsDropdown;
