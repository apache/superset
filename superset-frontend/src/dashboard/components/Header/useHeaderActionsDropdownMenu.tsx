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
import { useSelector, useDispatch } from 'react-redux';
import { Menu, MenuItem } from '@superset-ui/core/components/Menu';
import { t } from '@superset-ui/core';
import { isEmpty } from 'lodash';
import { URL_PARAMS } from 'src/constants';
import { useShareMenuItems } from 'src/dashboard/components/menu/ShareMenuItems';
import { useDownloadMenuItems } from 'src/dashboard/components/menu/DownloadMenuItems';
import { useHeaderReportMenuItems } from 'src/features/reports/ReportModal/HeaderReportDropdown';
import CssEditor from 'src/dashboard/components/CssEditor';
import RefreshIntervalModal from 'src/dashboard/components/RefreshIntervalModal';
import SaveModal from 'src/dashboard/components/SaveModal';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';
import { SAVE_TYPE_NEWDASHBOARD } from 'src/dashboard/util/constants';
import FilterScopeModal from 'src/dashboard/components/filterscope/FilterScopeModal';
import getDashboardUrl from 'src/dashboard/util/getDashboardUrl';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { getUrlParam } from 'src/utils/urlUtils';
import { MenuKeys, RootState } from 'src/dashboard/types';
import { HeaderDropdownProps } from 'src/dashboard/components/Header/types';
import { updateDashboardTheme } from 'src/dashboard/actions/dashboardInfo';

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
  const dispatch = useDispatch();
  const [css, setCss] = useState(customCss || '');
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

  const handleThemeChange = useCallback(
    async (themeId: number | null) => {
      // Save the theme to the dashboard
      // The CrudThemeProvider will handle applying the theme to dashboard content only
      dispatch(updateDashboardTheme(themeId));
    },
    [dispatch],
  );

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

  const shareMenuItems = useShareMenuItems({
    title: t('Share'),
    disabled: isLoading,
    url,
    dashboardId,
    dashboardComponentId,
    copyMenuItemTitle: t('Copy permalink to clipboard'),
    emailMenuItemTitle: t('Share permalink by email'),
    emailSubject,
    emailBody: t('Check out this dashboard: '),
    addSuccessToast,
    addDangerToast,
  });

  const downloadMenuItem = useDownloadMenuItems({
    pdfMenuItemTitle: t('Export to PDF'),
    imageMenuItemTitle: t('Download as Image'),
    dashboardTitle,
    dashboardId,
    title: t('Download'),
    disabled: isLoading,
    logEvent,
  });

  const reportMenuItem = useHeaderReportMenuItems({
    dashboardId: dashboardInfo?.id,
    showReportModal,
    setCurrentReportDeleting,
  });

  // Helper function to create menu items for components with triggerNode
  const createModalMenuItem = (
    key: string,
    modalComponent: React.ReactElement,
  ): MenuItem => ({
    key,
    label: modalComponent,
  });

  const menu = useMemo(() => {
    const isEmbedded = !dashboardInfo?.userId;
    const refreshIntervalOptions =
      dashboardInfo?.common?.conf?.DASHBOARD_AUTO_REFRESH_INTERVALS;

    const menuItems: MenuItem[] = [];

    // Refresh dashboard
    if (!editMode) {
      menuItems.push({
        key: MenuKeys.RefreshDashboard,
        label: t('Refresh dashboard'),
        disabled: isLoading,
      });
    }

    // Toggle fullscreen
    if (!editMode && !isEmbedded) {
      menuItems.push({
        key: MenuKeys.ToggleFullscreen,
        label: getUrlParam(URL_PARAMS.standalone)
          ? t('Exit fullscreen')
          : t('Enter fullscreen'),
      });
    }

    // Edit properties
    if (editMode) {
      menuItems.push({
        key: MenuKeys.EditProperties,
        label: t('Edit properties'),
      });
    }

    // Edit CSS
    if (editMode) {
      menuItems.push(
        createModalMenuItem(
          MenuKeys.EditCss,
          <CssEditor
            triggerNode={<div>{t('Theme & CSS')}</div>}
            initialCss={css}
            onChange={changeCss}
            addDangerToast={addDangerToast}
            currentThemeId={dashboardInfo.theme?.id || null}
            onThemeChange={handleThemeChange}
          />,
        ),
      );
    }

    // Divider
    menuItems.push({ type: 'divider' });

    // Save as
    if (userCanSave) {
      menuItems.push(
        createModalMenuItem(
          MenuKeys.SaveModal,
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
          />,
        ),
      );
    }

    // Download submenu
    menuItems.push(downloadMenuItem);

    // Share submenu
    if (userCanShare) {
      menuItems.push(shareMenuItems);
    }

    // Embed dashboard
    if (!editMode && userCanCurate) {
      menuItems.push({
        key: MenuKeys.ManageEmbedded,
        label: t('Embed dashboard'),
      });
    }

    // Divider
    menuItems.push({ type: 'divider' });

    // Report dropdown
    if (!editMode && reportMenuItem) {
      menuItems.push(reportMenuItem);
    }

    // Set filter mapping
    if (editMode && !isEmpty(dashboardInfo?.metadata?.filter_scopes)) {
      menuItems.push(
        createModalMenuItem(
          MenuKeys.SetFilterMapping,
          <FilterScopeModal
            triggerNode={<div>{t('Set filter mapping')}</div>}
          />,
        ),
      );
    }

    // Auto-refresh interval
    menuItems.push(
      createModalMenuItem(
        MenuKeys.AutorefreshModal,
        <RefreshIntervalModal
          addSuccessToast={addSuccessToast}
          refreshFrequency={refreshFrequency}
          refreshLimit={refreshLimit}
          refreshWarning={refreshWarning}
          onChange={changeRefreshInterval}
          editMode={editMode}
          refreshIntervalOptions={refreshIntervalOptions}
          triggerNode={<div>{t('Set auto-refresh interval')}</div>}
        />,
      ),
    );

    return (
      <Menu
        selectable={false}
        data-test="header-actions-menu"
        onClick={handleMenuClick}
        items={menuItems}
      />
    );
  }, [
    addDangerToast,
    addSuccessToast,
    changeRefreshInterval,
    changeCss,
    colorNamespace,
    colorScheme,
    css,
    customCss,
    dashboardId,
    dashboardInfo,
    dashboardTitle,
    downloadMenuItem,
    editMode,
    expandedSlices,
    handleMenuClick,
    isLoading,
    lastModifiedTime,
    layout,
    onSave,
    refreshFrequency,
    refreshLimit,
    refreshWarning,
    reportMenuItem,
    shareMenuItems,
    shouldPersistRefreshFrequency,
    userCanCurate,
    userCanEdit,
    userCanSave,
    userCanShare,
  ]);

  return [menu, isDropdownVisible, setIsDropdownVisible];
};
