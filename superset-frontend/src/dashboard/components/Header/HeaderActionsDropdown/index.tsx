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
import { PureComponent } from 'react';
import { isEmpty } from 'lodash';
import { connect } from 'react-redux';
import { t } from '@superset-ui/core';
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
import { MenuKeys, RootState } from 'src/dashboard/types';
import { HeaderDropdownProps } from 'src/dashboard/components/Header/types';

const mapStateToProps = (state: RootState) => ({
  directPathToChild: state.dashboardState.directPathToChild,
});

interface HeaderActionsDropdownState {
  css: string;
  showReportSubMenu: boolean | null;
}

export class HeaderActionsDropdown extends PureComponent<
  HeaderDropdownProps,
  HeaderActionsDropdownState
> {
  static defaultProps = {
    colorNamespace: undefined,
    colorScheme: undefined,
    refreshLimit: 0,
    refreshWarning: null,
  };

  constructor(props: HeaderDropdownProps) {
    super(props);
    this.state = {
      css: props.customCss || '',
      showReportSubMenu: null,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps: HeaderDropdownProps) {
    if (this.props.customCss !== nextProps.customCss) {
      this.setState({ css: nextProps.customCss }, () => {
        injectCustomCss(nextProps.customCss);
      });
    }
  }

  setShowReportSubMenu = (show: boolean) => {
    this.setState({ showReportSubMenu: show });
  };

  changeCss = (css: string) => {
    this.props.onChange();
    this.props.updateCss(css);
  };

  changeRefreshInterval = (refreshInterval: number, isPersistent: boolean) => {
    this.props.setRefreshFrequency(refreshInterval, isPersistent);
    this.props.startPeriodicRender(refreshInterval * 1000);
  };

  handleMenuClick = ({ key }: Record<string, any>) => {
    switch (key) {
      case MenuKeys.RefreshDashboard:
        this.props.forceRefreshAllCharts();
        this.props.addSuccessToast(t('Refreshing charts'));
        break;
      case MenuKeys.EditProperties:
        this.props.showPropertiesModal();
        break;
      case MenuKeys.ToggleFullscreen: {
        const isCurrentlyStandalone =
          Number(getUrlParam(URL_PARAMS.standalone)) === 1;
        const url = getDashboardUrl({
          pathname: window.location.pathname,
          filters: getActiveFilters(),
          hash: window.location.hash,
          standalone: isCurrentlyStandalone ? null : 1,
        });
        window.location.replace(url);
        break;
      }
      case MenuKeys.ManageEmbedded: {
        this.props.manageEmbedded();
        break;
      }
      default:
        break;
    }
  };

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
      directPathToChild,
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

    const dashboardComponentId = [...(directPathToChild || [])].pop();

    return (
      <Menu selectable={false} data-test="header-actions-menu" {...rest}>
        {!editMode && (
          <Menu.Item
            key={MenuKeys.RefreshDashboard}
            data-test="refresh-dashboard-menu-item"
            disabled={isLoading}
            onClick={this.handleMenuClick}
          >
            {t('Refresh dashboard')}
          </Menu.Item>
        )}
        {!editMode && !isEmbedded && (
          <Menu.Item
            key={MenuKeys.ToggleFullscreen}
            onClick={this.handleMenuClick}
          >
            {getUrlParam(URL_PARAMS.standalone)
              ? t('Exit fullscreen')
              : t('Enter fullscreen')}
          </Menu.Item>
        )}
        {editMode && (
          <Menu.Item
            key={MenuKeys.EditProperties}
            onClick={this.handleMenuClick}
          >
            {t('Edit properties')}
          </Menu.Item>
        )}
        {editMode && (
          <Menu.Item key={MenuKeys.EditCss}>
            <CssEditor
              triggerNode={<div>{t('Edit CSS')}</div>}
              initialCss={this.state.css}
              onChange={this.changeCss}
              addDangerToast={addDangerToast}
            />
          </Menu.Item>
        )}
        <Menu.Divider />
        {userCanSave && (
          <Menu.Item key={MenuKeys.SaveModal}>
            <SaveModal
              addSuccessToast={addSuccessToast}
              addDangerToast={addDangerToast}
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
                <div data-test="save-as-menu-item">{t('Save as')}</div>
              }
              canOverwrite={userCanEdit}
            />
          </Menu.Item>
        )}
        <Menu.SubMenu
          key={MenuKeys.Download}
          disabled={isLoading}
          title={t('Download')}
        >
          <DownloadMenuItems
            pdfMenuItemTitle={t('Export to PDF')}
            imageMenuItemTitle={t('Download as Image')}
            dashboardTitle={dashboardTitle}
            dashboardId={dashboardId}
            logEvent={this.props.logEvent}
          />
        </Menu.SubMenu>
        {userCanShare && (
          <ShareMenuItems
            key={MenuKeys.Share}
            data-test="share-dashboard-menu-item"
            title={t('Share')}
            url={url}
            copyMenuItemTitle={t('Copy permalink to clipboard')}
            emailMenuItemTitle={t('Share permalink by email')}
            emailSubject={emailSubject}
            emailBody={emailBody}
            addSuccessToast={addSuccessToast}
            addDangerToast={addDangerToast}
            dashboardId={dashboardId}
            dashboardComponentId={dashboardComponentId}
          />
        )}
        {!editMode && userCanCurate && (
          <Menu.Item
            key={MenuKeys.ManageEmbedded}
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
        {editMode && !isEmpty(dashboardInfo?.metadata?.filter_scopes) && (
          <Menu.Item key={MenuKeys.SetFilterMapping}>
            <FilterScopeModal
              triggerNode={
                <div className="m-r-5">{t('Set filter mapping')}</div>
              }
            />
          </Menu.Item>
        )}

        <Menu.Item key={MenuKeys.AutorefreshModal}>
          <RefreshIntervalModal
            addSuccessToast={addSuccessToast}
            refreshFrequency={refreshFrequency}
            refreshLimit={refreshLimit}
            refreshWarning={refreshWarning}
            onChange={this.changeRefreshInterval}
            editMode={editMode}
            refreshIntervalOptions={refreshIntervalOptions}
            triggerNode={<div>{t('Set auto-refresh interval')}</div>}
          />
        </Menu.Item>
      </Menu>
    );
  }
}

export default connect(mapStateToProps)(HeaderActionsDropdown);
