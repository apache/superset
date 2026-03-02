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
/* eslint-env browser */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isFeatureEnabled,
  FeatureFlag,
  getExtensionsRegistry,
} from '@superset-ui/core';
import {
  styled,
  css,
  SupersetTheme,
  t,
  useTheme,
} from '@apache-superset/core/ui';
import { Global } from '@emotion/react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { bindActionCreators } from 'redux';
import { LOG_ACTIONS_TOGGLE_EDIT_DASHBOARD } from 'src/logger/LogUtils';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  Button,
  Tooltip,
  DeleteModal,
  UnsavedChangesModal,
  Grid,
} from '@superset-ui/core/components';
import { findPermission } from 'src/utils/findPermission';
import { safeStringify } from 'src/utils/safeStringify';
import Role from 'src/types/Role';
import Owner from 'src/types/Owner';
import { DashboardLayout, RootState } from 'src/dashboard/types';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { AlertObject } from 'src/features/alerts/types';
import PublishedStatus from 'src/dashboard/components/PublishedStatus';
import UndoRedoKeyListeners from 'src/dashboard/components/UndoRedoKeyListeners';
import PropertiesModal from 'src/dashboard/components/PropertiesModal';
import RefreshIntervalModal from 'src/dashboard/components/RefreshIntervalModal';
import {
  UNDO_LIMIT,
  SAVE_TYPE_OVERWRITE,
  DASHBOARD_POSITION_DATA_LIMIT,
  DASHBOARD_HEADER_ID,
} from 'src/dashboard/util/constants';
import { TagType, TagTypeEnum } from 'src/components/Tag/TagType';
import ReportModal from 'src/features/reports/ReportModal';
import {
  deleteActiveReport,
  DeletableReport,
} from 'src/features/reports/ReportModal/actions';
import { PageHeaderWithActions } from '@superset-ui/core/components/PageHeaderWithActions';
import { useUnsavedChangesPrompt } from 'src/hooks/useUnsavedChangesPrompt';
import DashboardEmbedModal from '../EmbeddedModal';
import OverwriteConfirm from '../OverwriteConfirm';
import {
  addDangerToast,
  addSuccessToast,
  addWarningToast,
} from '../../../components/MessageToasts/actions';
import {
  dashboardTitleChanged,
  redoLayoutAction,
  undoLayoutAction,
  updateDashboardTitle,
  clearDashboardHistory,
} from '../../actions/dashboardLayout';
import {
  fetchCharts,
  fetchFaveStar,
  maxUndoHistoryToast,
  onChange,
  onRefresh,
  saveDashboardRequest,
  saveFaveStar,
  savePublished,
  setEditMode,
  setMaxUndoHistoryExceeded,
  setRefreshFrequency,
  setUnsavedChanges,
} from '../../actions/dashboardState';
import { logEvent } from '../../../logger/actions';
import { dashboardInfoChanged } from '../../actions/dashboardInfo';
import { ChartState } from 'src/explore/types';
import { useChartIds } from '../../util/charts/useChartIds';
import { useDashboardMetadataBar } from './useDashboardMetadataBar';
import { useHeaderActionsMenu } from './useHeaderActionsDropdownMenu';
import { useHeaderAutoRefresh } from './useHeaderAutoRefresh';
import AutoRefreshIndicator from '../AutoRefreshIndicator';
import { RefreshButton } from '../RefreshButton';

type DashboardPropertiesUpdate = {
  slug?: string;
  jsonMetadata?: string;
  certifiedBy?: string;
  certificationDetails?: string;
  owners?: Owner[];
  roles?: Role[];
  tags?: TagType[];
  themeId?: number | null;
  css?: string;
  title?: string;
};

type DashboardLayoutStateWithHistory = RootState['dashboardLayout'] & {
  past: DashboardLayout[];
  future: DashboardLayout[];
};

type DashboardInfoState = RootState['dashboardInfo'] & {
  dash_save_perm?: boolean;
  dash_share_perm?: boolean;
  is_managed_externally?: boolean;
  slug?: string;
  last_modified_time?: number;
  certified_by?: string;
  certification_details?: string;
  roles?: Role[];
  tags?: TagType[];
  metadata: RootState['dashboardInfo']['metadata'] & {
    timed_refresh_immune_slices?: number[];
    refresh_frequency?: number;
  };
};

type DashboardStateWithExtras = RootState['dashboardState'] & {
  expandedSlices: Record<number, boolean>;
  shouldPersistRefreshFrequency?: boolean;
  colorNamespace?: string;
  isStarred?: boolean;
  maxUndoHistoryExceeded?: boolean;
};

type HeaderRootState = Omit<
  RootState,
  'dashboardLayout' | 'dashboardInfo' | 'dashboardState' | 'charts' | 'user'
> & {
  dashboardLayout: DashboardLayoutStateWithHistory;
  dashboardInfo: DashboardInfoState;
  dashboardState: DashboardStateWithExtras;
  charts: Record<string, ChartState>;
  user: UserWithPermissionsAndRoles;
  lastModifiedTime: number;
};

const extensionsRegistry = getExtensionsRegistry();

const headerContainerStyle = (theme: SupersetTheme) => css`
  border-bottom: 1px solid ${theme.colorBorder};
`;

const editButtonStyle = (theme: SupersetTheme) => css`
  color: ${theme.colorPrimary};
`;

const actionButtonsStyle = (theme: SupersetTheme) => css`
  display: flex;
  align-items: center;

  .action-schedule-report {
    margin-left: ${theme.sizeUnit * 2}px;
  }

  .undoRedo {
    display: flex;
    margin-right: ${theme.sizeUnit * 2}px;
  }
`;

const StyledUndoRedoButton = styled(Button)`
  // TODO: check if we need this
  padding: 0;
  &:hover {
    background: transparent;
  }
`;

const undoRedoStyle = (theme: SupersetTheme) => css`
  color: ${theme.colorIcon};
  &:hover {
    color: ${theme.colorIconHover};
  }
`;

const undoRedoEmphasized = (theme: SupersetTheme) => css`
  color: ${theme.colorIcon};
`;

const undoRedoDisabled = (theme: SupersetTheme) => css`
  color: ${theme.colorTextDisabled};
`;

const saveBtnStyle = (theme: SupersetTheme) => css`
  min-width: ${theme.sizeUnit * 17}px;
  height: ${theme.sizeUnit * 8}px;
  span > :first-of-type {
    margin-right: 0;
  }
`;

const discardBtnStyle = (theme: SupersetTheme) => css`
  min-width: ${theme.sizeUnit * 22}px;
  height: ${theme.sizeUnit * 8}px;
`;

const discardChanges = () => {
  const url = new URL(window.location.href);

  url.searchParams.delete('edit');
  window.location.assign(url);
};

const { useBreakpoint } = Grid;

interface HeaderComponentProps {
  onOpenMobileFilters?: () => void;
}

const Header = ({ onOpenMobileFilters }: HeaderComponentProps): JSX.Element => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [didNotifyMaxUndoHistoryToast, setDidNotifyMaxUndoHistoryToast] =
    useState(false);
  const [emphasizeUndo, setEmphasizeUndo] = useState(false);
  const [emphasizeRedo, setEmphasizeRedo] = useState(false);
  const [showingPropertiesModal, setShowingPropertiesModal] = useState(false);
  const [showingRefreshModal, setShowingRefreshModal] = useState(false);
  const [showingEmbedModal, setShowingEmbedModal] = useState(false);
  const [showingReportModal, setShowingReportModal] = useState(false);
  const [currentReportDeleting, setCurrentReportDeleting] =
    useState<AlertObject | null>(null);
  const dashboardInfo = useSelector(
    (state: HeaderRootState) => state.dashboardInfo,
  );
  const layout = useSelector(
    (state: HeaderRootState) => state.dashboardLayout.present,
  );
  const undoLength = useSelector(
    (state: HeaderRootState) => state.dashboardLayout.past.length,
  );
  const redoLength = useSelector(
    (state: HeaderRootState) => state.dashboardLayout.future.length,
  );
  const user = useSelector((state: HeaderRootState) => state.user);
  const chartIds = useChartIds();

  const {
    expandedSlices,
    refreshFrequency,
    shouldPersistRefreshFrequency,
    customCss,
    colorNamespace,
    colorScheme,
    isStarred,
    isPublished,
    hasUnsavedChanges,
    maxUndoHistoryExceeded,
    editMode,
    lastModifiedTime,
  } = useSelector(
    (state: HeaderRootState) => ({
      expandedSlices: state.dashboardState.expandedSlices ?? {},
      refreshFrequency: state.dashboardState.refreshFrequency ?? 0,
      shouldPersistRefreshFrequency:
        !!state.dashboardState.shouldPersistRefreshFrequency,
      customCss: state.dashboardInfo.css ?? '',
      colorNamespace: state.dashboardState.colorNamespace,
      colorScheme: state.dashboardState.colorScheme,
      isStarred: !!state.dashboardState.isStarred,
      isPublished: !!state.dashboardState.isPublished,
      hasUnsavedChanges: !!state.dashboardState.hasUnsavedChanges,
      maxUndoHistoryExceeded: !!state.dashboardState.maxUndoHistoryExceeded,
      editMode: !!state.dashboardState.editMode,
      lastModifiedTime: state.lastModifiedTime ?? 0,
    }),
    shallowEqual,
  );
  const isLoading = useSelector((state: HeaderRootState) =>
    Object.values(state.charts).some(chart => {
      const start = chart.chartUpdateStartTime ?? 0;
      const end = chart.chartUpdateEndTime ?? 0;
      return start > end;
    }),
  );
  const ctrlYTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctrlZTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousThemeRef = useRef(dashboardInfo.theme);

  const dashboardTitle = layout[DASHBOARD_HEADER_ID]?.meta?.text ?? '';
  const slug = dashboardInfo.slug ?? '';
  const actualLastModifiedTime = Math.max(
    lastModifiedTime,
    dashboardInfo.last_modified_time ?? 0,
  );
  const themeId = dashboardInfo.theme ? dashboardInfo.theme.id : null;
  const boundActionCreators = useMemo(
    () =>
      bindActionCreators(
        {
          addSuccessToast,
          addDangerToast,
          addWarningToast,
          onUndo: undoLayoutAction,
          onRedo: redoLayoutAction,
          clearDashboardHistory,
          setEditMode,
          setUnsavedChanges,
          fetchFaveStar,
          saveFaveStar,
          savePublished,
          fetchCharts,
          updateDashboardTitle,
          onChange,
          onSave: saveDashboardRequest,
          setMaxUndoHistoryExceeded,
          maxUndoHistoryToast,
          logEvent,
          setRefreshFrequency,
          onRefresh,
          dashboardInfoChanged,
          dashboardTitleChanged,
        },
        dispatch,
      ),
    [dispatch],
  );

  // Extract stable values from dashboardInfo for use in callbacks
  // This prevents unnecessary recreations when unrelated dashboardInfo properties change
  const timedRefreshImmuneSlices = useMemo(
    () => dashboardInfo.metadata?.timed_refresh_immune_slices || [],
    [dashboardInfo.metadata?.timed_refresh_immune_slices],
  );
  const autoRefreshMode =
    dashboardInfo.common?.conf?.DASHBOARD_AUTO_REFRESH_MODE;
  const {
    forceRefresh,
    handlePauseToggle,
    autoRefreshPauseOnInactiveTab,
    setPauseOnInactiveTab,
  } = useHeaderAutoRefresh({
    chartIds,
    dashboardId: dashboardInfo.id,
    refreshFrequency,
    timedRefreshImmuneSlices,
    autoRefreshMode,
    isLoading,
    onRefresh: boundActionCreators.onRefresh,
    setRefreshFrequency: boundActionCreators.setRefreshFrequency,
    logEvent: boundActionCreators.logEvent,
  });

  // Track theme changes as unsaved changes, and sync ref when navigating between dashboards
  useEffect(() => {
    if (editMode && dashboardInfo.theme !== previousThemeRef.current) {
      boundActionCreators.setUnsavedChanges(true);
    }
    previousThemeRef.current = dashboardInfo.theme;
  }, [dashboardInfo.theme, editMode, boundActionCreators]);

  useEffect(() => {
    if (UNDO_LIMIT - undoLength <= 0 && !didNotifyMaxUndoHistoryToast) {
      setDidNotifyMaxUndoHistoryToast(true);
      boundActionCreators.maxUndoHistoryToast();
    }
    if (undoLength > UNDO_LIMIT && !maxUndoHistoryExceeded) {
      boundActionCreators.setMaxUndoHistoryExceeded();
    }
  }, [
    boundActionCreators,
    didNotifyMaxUndoHistoryToast,
    maxUndoHistoryExceeded,
    undoLength,
  ]);

  useEffect(
    () => () => {
      if (ctrlYTimeout.current !== null) {
        clearTimeout(ctrlYTimeout.current);
      }
      if (ctrlZTimeout.current !== null) {
        clearTimeout(ctrlZTimeout.current);
      }
    },
    [],
  );

  const handleChangeText = useCallback(
    (nextText: string) => {
      if (nextText && dashboardTitle !== nextText) {
        boundActionCreators.updateDashboardTitle(nextText);
        boundActionCreators.onChange();
      }
    },
    [boundActionCreators, dashboardTitle],
  );

  const handleCtrlY = useCallback(() => {
    boundActionCreators.onRedo();
    setEmphasizeRedo(true);
    if (ctrlYTimeout.current !== null) {
      clearTimeout(ctrlYTimeout.current);
    }
    ctrlYTimeout.current = setTimeout(() => {
      setEmphasizeRedo(false);
    }, 100);
  }, [boundActionCreators]);

  const handleCtrlZ = useCallback(() => {
    boundActionCreators.onUndo();
    setEmphasizeUndo(true);
    if (ctrlZTimeout.current !== null) {
      clearTimeout(ctrlZTimeout.current);
    }
    ctrlZTimeout.current = setTimeout(() => {
      setEmphasizeUndo(false);
    }, 100);
  }, [boundActionCreators]);

  const toggleEditMode = useCallback(() => {
    boundActionCreators.logEvent(LOG_ACTIONS_TOGGLE_EDIT_DASHBOARD, {
      edit_mode: !editMode,
    });
    boundActionCreators.setEditMode(!editMode);
  }, [boundActionCreators, editMode]);

  const overwriteDashboard = useCallback(() => {
    const currentColorNamespace =
      dashboardInfo?.metadata?.color_namespace || colorNamespace;
    const currentColorScheme =
      dashboardInfo?.metadata?.color_scheme || colorScheme;

    const data = {
      certified_by: dashboardInfo.certified_by,
      certification_details: dashboardInfo.certification_details,
      css: customCss,
      dashboard_title: dashboardTitle,
      last_modified_time: actualLastModifiedTime,
      owners: dashboardInfo.owners,
      roles: dashboardInfo.roles,
      slug,
      tags: (dashboardInfo.tags || []).filter(
        item => item.type === TagTypeEnum.Custom || !item.type,
      ),
      theme_id: themeId,
      metadata: {
        ...dashboardInfo?.metadata,
        color_namespace: currentColorNamespace,
        color_scheme: currentColorScheme,
        positions: layout,
        refresh_frequency: shouldPersistRefreshFrequency
          ? refreshFrequency
          : dashboardInfo.metadata?.refresh_frequency,
      },
    };

    // make sure positions data less than DB storage limitation:
    const positionJSONLength = safeStringify(layout).length;
    const limit =
      dashboardInfo.common?.conf?.SUPERSET_DASHBOARD_POSITION_DATA_LIMIT ||
      DASHBOARD_POSITION_DATA_LIMIT;
    if (positionJSONLength >= limit) {
      boundActionCreators.addDangerToast(
        t(
          'Your dashboard is too large. Please reduce its size before saving it.',
        ),
      );
    } else {
      if (positionJSONLength >= limit * 0.9) {
        boundActionCreators.addWarningToast(
          t('Your dashboard is near the size limit.'),
        );
      }

      boundActionCreators.onSave(data, dashboardInfo.id, SAVE_TYPE_OVERWRITE);
    }
  }, [
    actualLastModifiedTime,
    boundActionCreators,
    colorNamespace,
    colorScheme,
    customCss,
    dashboardInfo.certification_details,
    dashboardInfo.certified_by,
    dashboardInfo.common?.conf?.SUPERSET_DASHBOARD_POSITION_DATA_LIMIT,
    dashboardInfo.id,
    dashboardInfo.metadata,
    dashboardInfo.owners,
    dashboardInfo.roles,
    dashboardInfo.tags,
    dashboardTitle,
    layout,
    refreshFrequency,
    shouldPersistRefreshFrequency,
    slug,
    themeId,
  ]);

  const {
    showModal: showUnsavedChangesModal,
    setShowModal: setShowUnsavedChangesModal,
    handleConfirmNavigation,
    handleSaveAndCloseModal,
  } = useUnsavedChangesPrompt({
    hasUnsavedChanges,
    onSave: overwriteDashboard,
  });

  const showPropertiesModal = useCallback(() => {
    setShowingPropertiesModal(true);
  }, []);

  const hidePropertiesModal = useCallback(() => {
    setShowingPropertiesModal(false);
  }, []);
  const showRefreshModal = useCallback(() => {
    setShowingRefreshModal(true);
  }, []);
  const hideRefreshModal = useCallback(() => {
    setShowingRefreshModal(false);
  }, []);

  const showEmbedModal = useCallback(() => {
    setShowingEmbedModal(true);
  }, []);

  const hideEmbedModal = useCallback(() => {
    setShowingEmbedModal(false);
  }, []);

  const showReportModal = useCallback(() => {
    setShowingReportModal(true);
  }, []);

  const hideReportModal = useCallback(() => {
    setShowingReportModal(false);
  }, []);

  const metadataBar = useDashboardMetadataBar(dashboardInfo);

  const userCanEdit =
    dashboardInfo.dash_edit_perm && !dashboardInfo.is_managed_externally;
  const userCanShare = !!dashboardInfo.dash_share_perm;
  const userCanSaveAs = !!dashboardInfo.dash_save_perm;
  const userCanCurate =
    isFeatureEnabled(FeatureFlag.EmbeddedSuperset) &&
    findPermission('can_set_embedded', 'Dashboard', user.roles);
  const userCanExport = !!dashboardInfo.dash_export_perm;
  const isEmbedded = !dashboardInfo?.userId;

  const handleOnPropertiesChange = useCallback(
    (updates: DashboardPropertiesUpdate) => {
      boundActionCreators.dashboardInfoChanged({
        slug: updates.slug,
        metadata: JSON.parse(updates.jsonMetadata || '{}'),
        certified_by: updates.certifiedBy,
        certification_details: updates.certificationDetails,
        owners: updates.owners,
        roles: updates.roles,
        tags: updates.tags,
        theme_id: updates.themeId,
        css: updates.css,
      });
      boundActionCreators.setUnsavedChanges(true);

      if (updates.title && dashboardTitle !== updates.title) {
        boundActionCreators.updateDashboardTitle(updates.title);
        boundActionCreators.onChange();
      }
    },
    [boundActionCreators, dashboardTitle],
  );

  const handleRefreshChange = useCallback(
    (refreshFrequency: number, editMode: boolean) => {
      boundActionCreators.setRefreshFrequency(refreshFrequency, !!editMode);
    },
    [boundActionCreators],
  );

  const handleEnterEditMode = useCallback(() => {
    toggleEditMode();
    boundActionCreators.clearDashboardHistory?.();
    boundActionCreators.setUnsavedChanges(false);
  }, [toggleEditMode, boundActionCreators]);

  const NavExtension = extensionsRegistry.get('dashboard.nav.right');

  const editableTitleProps = useMemo(
    () => ({
      title: dashboardTitle,
      canEdit: userCanEdit && editMode,
      onSave: handleChangeText,
      placeholder: t('Add the name of the dashboard'),
      label: t('Dashboard title'),
      showTooltip: false,
    }),
    [dashboardTitle, editMode, handleChangeText, userCanEdit],
  );

  const certifiedBadgeProps = useMemo(
    () => ({
      certifiedBy: dashboardInfo.certified_by,
      details: dashboardInfo.certification_details,
    }),
    [dashboardInfo.certification_details, dashboardInfo.certified_by],
  );

  const faveStarProps = useMemo(
    () => ({
      itemId: dashboardInfo.id,
      fetchFaveStar: boundActionCreators.fetchFaveStar,
      saveFaveStar: boundActionCreators.saveFaveStar,
      isStarred,
      showTooltip: true,
    }),
    [
      boundActionCreators.fetchFaveStar,
      boundActionCreators.saveFaveStar,
      dashboardInfo.id,
      isStarred,
    ],
  );

  const titlePanelAdditionalItems = useMemo(
    () => [
      !editMode && (
        <RefreshButton key="refresh-button" onRefresh={forceRefresh} />
      ),
      !editMode && (
        <AutoRefreshIndicator
          key="auto-refresh-indicator"
          onTogglePause={handlePauseToggle}
        />
      ),
      !editMode && !isMobile && (
        <PublishedStatus
          key="published-status"
          dashboardId={dashboardInfo.id}
          isPublished={isPublished}
          savePublished={boundActionCreators.savePublished}
          userCanEdit={userCanEdit}
          userCanSave={userCanSaveAs}
        />
      ),
      !editMode && !isEmbedded && !isMobile && metadataBar,
    ],
    [
      boundActionCreators.savePublished,
      dashboardInfo.id,
      editMode,
      isMobile,
      metadataBar,
      isEmbedded,
      isPublished,
      userCanEdit,
      userCanSaveAs,
      handlePauseToggle,
      forceRefresh,
    ],
  );

  const rightPanelAdditionalItems = useMemo(
    () => (
      <div className="button-container">
        {userCanSaveAs && (
          <div className="button-container" data-test="dashboard-edit-actions">
            {editMode && (
              <div css={actionButtonsStyle}>
                <div className="undoRedo">
                  <Tooltip
                    id="dashboard-undo-tooltip"
                    title={t('Undo the action')}
                  >
                    <StyledUndoRedoButton
                      buttonStyle="link"
                      disabled={undoLength < 1}
                      onClick={
                        undoLength > 0 ? boundActionCreators.onUndo : undefined
                      }
                    >
                      <Icons.Undo
                        css={[
                          undoRedoStyle,
                          emphasizeUndo && undoRedoEmphasized,
                          undoLength < 1 && undoRedoDisabled,
                        ]}
                        data-test="undo-action"
                        iconSize="xl"
                      />
                    </StyledUndoRedoButton>
                  </Tooltip>
                  <Tooltip
                    id="dashboard-redo-tooltip"
                    title={t('Redo the action')}
                  >
                    <StyledUndoRedoButton
                      buttonStyle="link"
                      disabled={redoLength < 1}
                      onClick={
                        redoLength > 0 ? boundActionCreators.onRedo : undefined
                      }
                    >
                      <Icons.Redo
                        css={[
                          undoRedoStyle,
                          emphasizeRedo && undoRedoEmphasized,
                          redoLength < 1 && undoRedoDisabled,
                        ]}
                        data-test="redo-action"
                        iconSize="xl"
                      />
                    </StyledUndoRedoButton>
                  </Tooltip>
                </div>
                <Button
                  css={discardBtnStyle}
                  buttonSize="small"
                  onClick={discardChanges}
                  buttonStyle="secondary"
                  data-test="discard-changes-button"
                  aria-label={t('Discard')}
                >
                  {t('Discard')}
                </Button>
                <Button
                  css={saveBtnStyle}
                  buttonSize="small"
                  disabled={!hasUnsavedChanges}
                  buttonStyle="primary"
                  onClick={overwriteDashboard}
                  data-test="header-save-button"
                  aria-label={t('Save')}
                >
                  <Icons.SaveOutlined iconSize="m" />
                  {t('Save')}
                </Button>
              </div>
            )}
          </div>
        )}
        {editMode ? (
          <UndoRedoKeyListeners onUndo={handleCtrlZ} onRedo={handleCtrlY} />
        ) : (
          <div css={actionButtonsStyle}>
            {NavExtension && <NavExtension />}
            {userCanEdit && !isMobile && (
              <Button
                buttonStyle="secondary"
                onClick={handleEnterEditMode}
                data-test="edit-dashboard-button"
                className="action-button"
                css={editButtonStyle}
                aria-label={t('Edit dashboard')}
              >
                {t('Edit dashboard')}
              </Button>
            )}
          </div>
        )}
      </div>
    ),
    [
      NavExtension,
      boundActionCreators.onRedo,
      boundActionCreators.onUndo,
      editMode,
      emphasizeRedo,
      emphasizeUndo,
      handleCtrlY,
      handleCtrlZ,
      handleEnterEditMode,
      hasUnsavedChanges,
      isMobile,
      overwriteDashboard,
      redoLength,
      undoLength,
      userCanEdit,
      userCanSaveAs,
    ],
  );

  const handleReportDelete = async (report: AlertObject) => {
    await dispatch(deleteActiveReport(report as unknown as DeletableReport));
    setCurrentReportDeleting(null);
  };

  const [menu, isDropdownVisible, setIsDropdownVisible] = useHeaderActionsMenu({
    addSuccessToast: boundActionCreators.addSuccessToast,
    addDangerToast: boundActionCreators.addDangerToast,
    dashboardInfo,
    dashboardId: dashboardInfo.id,
    dashboardTitle,
    layout,
    expandedSlices,
    customCss,
    colorNamespace,
    colorScheme,
    onSave: boundActionCreators.onSave,
    forceRefreshAllCharts: forceRefresh,
    refreshFrequency,
    shouldPersistRefreshFrequency,
    editMode,
    hasUnsavedChanges,
    userCanEdit,
    userCanShare,
    userCanSave: userCanSaveAs,
    userCanCurate,
    userCanExport,
    isLoading,
    isMobile,
    isStarred,
    isPublished,
    saveFaveStar: boundActionCreators.saveFaveStar,
    showReportModal,
    showPropertiesModal,
    showRefreshModal,
    setCurrentReportDeleting,
    manageEmbedded: showEmbedModal,
    lastModifiedTime: actualLastModifiedTime,
    logEvent: boundActionCreators.logEvent,
  });
  return (
    <div
      css={headerContainerStyle}
      data-test="dashboard-header-container"
      data-test-id={dashboardInfo.id}
      className="dashboard-header-container"
    >
      <PageHeaderWithActions
        editableTitleProps={editableTitleProps}
        certificatiedBadgeProps={certifiedBadgeProps}
        faveStarProps={faveStarProps}
        leftPanelItems={
          onOpenMobileFilters && (
            <Button
              buttonStyle="link"
              aria-label={t('Open filters')}
              onClick={onOpenMobileFilters}
              data-test="mobile-filters-trigger"
            >
              <Icons.FilterOutlined
                iconColor={theme.colorPrimary}
                iconSize="l"
              />
            </Button>
          )
        }
        titlePanelAdditionalItems={titlePanelAdditionalItems}
        rightPanelAdditionalItems={rightPanelAdditionalItems}
        menuDropdownProps={{
          open: isDropdownVisible,
          onOpenChange: setIsDropdownVisible,
        }}
        additionalActionsMenu={menu}
        showFaveStar={!!(user?.userId && dashboardInfo?.id && !isMobile)}
        showTitlePanelItems
      />
      {showingPropertiesModal && (
        <PropertiesModal
          dashboardId={dashboardInfo.id}
          dashboardInfo={dashboardInfo}
          dashboardTitle={dashboardTitle}
          show={showingPropertiesModal}
          onHide={hidePropertiesModal}
          colorScheme={colorScheme}
          onSubmit={handleOnPropertiesChange}
          onlyApply
        />
      )}
      {showingRefreshModal && (
        <RefreshIntervalModal
          show={showingRefreshModal}
          onHide={hideRefreshModal}
          refreshFrequency={refreshFrequency}
          onChange={handleRefreshChange}
          editMode={editMode}
          addSuccessToast={boundActionCreators.addSuccessToast}
          pauseOnInactiveTab={autoRefreshPauseOnInactiveTab}
          onPauseOnInactiveTabChange={setPauseOnInactiveTab}
        />
      )}

      <ReportModal
        userId={user.userId}
        show={showingReportModal}
        onHide={hideReportModal}
        userEmail={user.email}
        dashboardId={dashboardInfo.id}
        creationMethod="dashboards"
      />

      {currentReportDeleting && (
        <DeleteModal
          description={t(
            'This action will permanently delete %s.',
            currentReportDeleting?.name,
          )}
          onConfirm={() => {
            if (currentReportDeleting) {
              handleReportDelete(currentReportDeleting);
            }
          }}
          onHide={() => setCurrentReportDeleting(null)}
          open
          title={t('Delete Report?')}
        />
      )}

      <OverwriteConfirm />

      {userCanCurate && (
        <DashboardEmbedModal
          show={showingEmbedModal}
          onHide={hideEmbedModal}
          dashboardId={String(dashboardInfo.id)}
        />
      )}
      <Global
        styles={css`
          .ant-menu-vertical {
            border-right: none;
          }
        `}
      />

      <UnsavedChangesModal
        title={t('Save changes to your dashboard?')}
        body={t("If you don't save, changes will be lost.")}
        showModal={showUnsavedChangesModal}
        onHide={() => setShowUnsavedChangesModal(false)}
        onConfirmNavigation={handleConfirmNavigation}
        handleSave={handleSaveAndCloseModal}
      />
    </div>
  );
};

export default Header;
