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
import type { Dispatch, ReactElement, SetStateAction } from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { Menu, MenuItem } from '@superset-ui/core/components/Menu';
import { t } from '@apache-superset/core';
import { isEmpty } from 'lodash';
import { URL_PARAMS } from 'src/constants';
import { useShareMenuItems } from 'src/dashboard/components/menu/ShareMenuItems';
import { useDownloadMenuItems } from 'src/dashboard/components/menu/DownloadMenuItems';
import { useHeaderReportMenuItems } from 'src/features/reports/ReportModal/HeaderReportDropdown';
import SaveModal from 'src/dashboard/components/SaveModal';
import injectCustomCss from 'src/dashboard/util/injectCustomCss';
import { SAVE_TYPE_NEWDASHBOARD } from 'src/dashboard/util/constants';
import FilterScopeModal from 'src/dashboard/components/filterscope/FilterScopeModal';
import getDashboardUrl from 'src/dashboard/util/getDashboardUrl';
import { getActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { getUrlParam } from 'src/utils/urlUtils';
import { MenuKeys, RootState } from 'src/dashboard/types';
import { HeaderDropdownProps } from 'src/dashboard/components/Header/types';
import getOwnerName from 'src/utils/getOwnerName';

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
  userCanExport,
  isLoading,
  isMobile,
  isStarred,
  isPublished,
  saveFaveStar,
  lastModifiedTime,
  addSuccessToast,
  addDangerToast,
  forceRefreshAllCharts,
  showPropertiesModal,
  showRefreshModal,
  showReportModal,
  manageEmbedded,
  dashboardTitle,
  logEvent,
  setCurrentReportDeleting,
}: HeaderDropdownProps): [
  ReactElement,
  boolean,
  Dispatch<SetStateAction<boolean>>,
] => {
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const history = useHistory();
  const directPathToChild = useSelector(
    (state: RootState) => state.dashboardState.directPathToChild,
  );

  useEffect(() => {
    if (customCss) {
      injectCustomCss(customCss);
    }
  }, [customCss]);

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
        case MenuKeys.AutorefreshModal:
          showRefreshModal();
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
          history.replace(url);
          break;
        }
        case MenuKeys.ManageEmbedded:
          manageEmbedded();
          break;
        case 'toggle-favorite':
          if (saveFaveStar && isStarred !== undefined) {
            saveFaveStar(dashboardId, isStarred);
          }
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
      showRefreshModal,
      manageEmbedded,
      saveFaveStar,
      dashboardId,
      isStarred,
      history,
    ],
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
    dashboardTitle: dashboardTitle ?? '',
    dashboardId,
    title: t('Download'),
    disabled: isLoading,
    logEvent,
    userCanExport,
  });

  const reportMenuItem = useHeaderReportMenuItems({
    dashboardId: dashboardInfo?.id,
    showReportModal,
    setCurrentReportDeleting: setCurrentReportDeleting as (
      report: unknown,
    ) => void,
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

    const menuItems: MenuItem[] = [];

    // Mobile-only: show dashboard info items in menu
    if (isMobile && !editMode) {
      // Favorite toggle
      if (saveFaveStar) {
        menuItems.push({
          key: 'toggle-favorite',
          label: isStarred ? t('Remove from favorites') : t('Add to favorites'),
        });
      }

      // Published status
      menuItems.push({
        key: 'status-info',
        label: isPublished ? t('Status: Published') : t('Status: Draft'),
        disabled: true,
      });

      // Owner info
      const ownerNames =
        dashboardInfo?.owners?.length > 0
          ? dashboardInfo.owners.map(getOwnerName).join(', ')
          : t('None');
      menuItems.push({
        key: 'owner-info',
        label: t('Owner: %(names)s', { names: ownerNames }),
        disabled: true,
      });

      // Last modified
      const modifiedBy =
        getOwnerName(dashboardInfo?.changed_by) || t('Not available');
      const modifiedDate = dashboardInfo?.changed_on_delta_humanized || '';
      menuItems.push({
        key: 'modified-info',
        label: t('Modified %(date)s by %(user)s', {
          date: modifiedDate,
          user: modifiedBy,
        }),
        disabled: true,
      });

      menuItems.push({ type: 'divider' });
    }

    // Refresh dashboard
    if (!editMode) {
      menuItems.push({
        key: MenuKeys.RefreshDashboard,
        label: t('Refresh dashboard'),
        disabled: isLoading,
      });

      // Auto-refresh settings (session-only in view mode)
      menuItems.push({
        key: MenuKeys.AutorefreshModal,
        label:
          refreshFrequency > 0
            ? t('Update auto-refresh')
            : t('Set auto-refresh'),
        disabled: isLoading,
      });
    }

    // Toggle fullscreen (hide on mobile)
    if (!editMode && !isEmbedded && !isMobile) {
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
            dashboardTitle={dashboardTitle ?? ''}
            dashboardInfo={dashboardInfo}
            saveType={SAVE_TYPE_NEWDASHBOARD}
            layout={layout}
            expandedSlices={expandedSlices ?? {}}
            refreshFrequency={refreshFrequency}
            shouldPersistRefreshFrequency={shouldPersistRefreshFrequency}
            lastModifiedTime={lastModifiedTime}
            customCss={customCss ?? ''}
            colorNamespace={colorNamespace}
            colorScheme={colorScheme}
            onSave={onSave}
            triggerNode={
              <div data-test="save-as-menu-item">{t('Save as')}</div>
            }
            canOverwrite={userCanEdit ?? false}
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

    // Only add divider if there are items after it
    const hasItemsAfterDivider =
      (!editMode && reportMenuItem && !isMobile) ||
      (editMode && !isEmpty(dashboardInfo?.metadata?.filter_scopes));

    if (hasItemsAfterDivider) {
      menuItems.push({ type: 'divider' });
    }

    // Report dropdown (hide on mobile)
    if (!editMode && reportMenuItem && !isMobile) {
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
    colorNamespace,
    colorScheme,
    customCss,
    dashboardId,
    dashboardInfo,
    dashboardTitle,
    downloadMenuItem,
    editMode,
    expandedSlices,
    handleMenuClick,
    isLoading,
    isMobile,
    isPublished,
    isStarred,
    lastModifiedTime,
    layout,
    onSave,
    refreshFrequency,
    reportMenuItem,
    saveFaveStar,
    shareMenuItems,
    shouldPersistRefreshFrequency,
    userCanCurate,
    userCanEdit,
    userCanSave,
    userCanShare,
  ]);

  return [menu, isDropdownVisible, setIsDropdownVisible];
};
