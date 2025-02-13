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
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Menu } from 'src/components/Menu';
import { t } from '@superset-ui/core';
import { isEmpty } from 'lodash';
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

export const useHeaderActionsMenu = ({
  customCss,
  dashboardId,
  dashboardInfo,
  refreshFrequency,
  shouldPersistRefreshFrequency,
  editMode,
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
  forceRefreshAllCharts,
  showPropertiesModal,
  showReportModal,
  manageEmbedded,
  onChange,
  updateCss,
  startPeriodicRender,
  setRefreshFrequency,
  dashboardTitle,
  logEvent,
  setCurrentReportDeleting,
}: HeaderDropdownProps) => {
  const [css, setCss] = useState(customCss || '');
  const [showReportSubMenu, setShowReportSubMenu] = useState<boolean | null>(
    null,
  );
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const directPathToChild = useSelector(
    (state: RootState) => state.dashboardState.directPathToChild,
  );
  useEffect(() => {
    if (customCss !== css) {
      setCss(customCss || '');
      injectCustomCss(customCss);
    }
  }, [css, customCss]);

  const handleMenuClick = useCallback(
    ({ key }: { key: string }) => {
      switch (key) {
        case MenuKeys.RefreshDashboard:
          forceRefreshAllCharts();
          addSuccessToast(t('Refreshing charts'));
          break;
        case MenuKeys.EditProperties:
          showPropertiesModal();
          break;
        case MenuKeys.ToggleFullscreen: {
          const url = getDashboardUrl({
            pathname: window.location.pathname,
            filters: getActiveFilters(),
            hash: window.location.hash,
            standalone: getUrlParam(URL_PARAMS.standalone),
          });
          window.location.replace(url);
          break;
        }
        case MenuKeys.ManageEmbedded:
          manageEmbedded();
          break;
        default:
          break;
      }
      setIsDropdownVisible(false);
    },
    [
      forceRefreshAllCharts,
      addSuccessToast,
      showPropertiesModal,
      manageEmbedded,
    ],
  );

  const changeCss = useCallback(
    (newCss: string) => {
      onChange();
      updateCss(newCss);
    },
    [onChange, updateCss],
  );

  const changeRefreshInterval = useCallback(
    (refreshInterval: number, isPersistent: boolean) => {
      setRefreshFrequency(refreshInterval, isPersistent);
      startPeriodicRender(refreshInterval * 1000);
    },
    [setRefreshFrequency, startPeriodicRender],
  );

  const emailSubject = useMemo(
    () => `${t('Superset dashboard')} ${dashboardTitle}`,
    [dashboardTitle],
  );

  const url = useMemo(
    () =>
      getDashboardUrl({
        pathname: window.location.pathname,
        filters: getActiveFilters(),
        hash: window.location.hash,
      }),
    [],
  );

  const dashboardComponentId = useMemo(
    () => [...(directPathToChild || [])].pop(),
    [directPathToChild],
  );

  const menu = useMemo(() => {
    const isEmbedded = !dashboardInfo?.userId;
    const refreshIntervalOptions =
      dashboardInfo.common?.conf?.DASHBOARD_AUTO_REFRESH_INTERVALS;

    return (
      <Menu
        selectable={false}
        data-test="header-actions-menu"
        onClick={handleMenuClick}
      >
        {!editMode && (
          <Menu.Item
            key={MenuKeys.RefreshDashboard}
            data-test="refresh-dashboard-menu-item"
            disabled={isLoading}
          >
            {t('Refresh dashboard')}
          </Menu.Item>
        )}
        {!editMode && !isEmbedded && (
          <Menu.Item key={MenuKeys.ToggleFullscreen}>
            {getUrlParam(URL_PARAMS.standalone)
              ? t('Exit fullscreen')
              : t('Enter fullscreen')}
          </Menu.Item>
        )}
        {editMode && (
          <Menu.Item key={MenuKeys.EditProperties}>
            {t('Edit properties')}
          </Menu.Item>
        )}
        {editMode && (
          <Menu.Item key={MenuKeys.EditCss}>
            <CssEditor
              triggerNode={<div>{t('Edit CSS')}</div>}
              initialCss={css}
              onChange={changeCss}
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
        <DownloadMenuItems
          submenuKey={MenuKeys.Download}
          disabled={isLoading}
          title={t('Download')}
          pdfMenuItemTitle={t('Export to PDF')}
          imageMenuItemTitle={t('Download as Image')}
          dashboardTitle={dashboardTitle}
          dashboardId={dashboardId}
          logEvent={logEvent}
        />
        {userCanShare && (
          <ShareMenuItems
            disabled={isLoading}
            data-test="share-dashboard-menu-item"
            title={t('Share')}
            url={url}
            copyMenuItemTitle={t('Copy permalink to clipboard')}
            emailMenuItemTitle={t('Share permalink by email')}
            emailSubject={emailSubject}
            emailBody={t('Check out this dashboard: ')}
            addSuccessToast={addSuccessToast}
            addDangerToast={addDangerToast}
            dashboardId={dashboardId}
            dashboardComponentId={dashboardComponentId}
          />
        )}
        {!editMode && userCanCurate && (
          <Menu.Item key={MenuKeys.ManageEmbedded}>
            {t('Embed dashboard')}
          </Menu.Item>
        )}
        <Menu.Divider />
        {!editMode ? (
          showReportSubMenu ? (
            <>
              <HeaderReportDropdown
                submenuTitle={t('Manage email report')}
                dashboardId={dashboardInfo.id}
                setShowReportSubMenu={setShowReportSubMenu}
                showReportModal={showReportModal}
                showReportSubMenu={showReportSubMenu}
                setCurrentReportDeleting={setCurrentReportDeleting}
                useTextMenu
              />
              <Menu.Divider />
            </>
          ) : (
            <HeaderReportDropdown
              dashboardId={dashboardInfo.id}
              setShowReportSubMenu={setShowReportSubMenu}
              showReportModal={showReportModal}
              setCurrentReportDeleting={setCurrentReportDeleting}
              useTextMenu
            />
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
            onChange={changeRefreshInterval}
            editMode={editMode}
            refreshIntervalOptions={refreshIntervalOptions}
            triggerNode={<div>{t('Set auto-refresh interval')}</div>}
          />
        </Menu.Item>
      </Menu>
    );
  }, [
    css,
    showReportSubMenu,
    isDropdownVisible,
    directPathToChild,
    handleMenuClick,
    changeCss,
    changeRefreshInterval,
    emailSubject,
    url,
    dashboardComponentId,
  ]);

  return [menu, isDropdownVisible, setIsDropdownVisible];
};
