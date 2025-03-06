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
import { extendedDayjs } from 'src/utils/dates';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  styled,
  css,
  isFeatureEnabled,
  FeatureFlag,
  t,
  getExtensionsRegistry,
} from '@superset-ui/core';
import { Global } from '@emotion/react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { bindActionCreators } from 'redux';
import {
  LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD,
  LOG_ACTIONS_FORCE_REFRESH_DASHBOARD,
  LOG_ACTIONS_TOGGLE_EDIT_DASHBOARD,
} from 'src/logger/LogUtils';
import Icons from 'src/components/Icons';
import { Button } from 'src/components/';
import { findPermission } from 'src/utils/findPermission';
import { Tooltip } from 'src/components/Tooltip';
import { safeStringify } from 'src/utils/safeStringify';
import PublishedStatus from 'src/dashboard/components/PublishedStatus';
import UndoRedoKeyListeners from 'src/dashboard/components/UndoRedoKeyListeners';
import PropertiesModal from 'src/dashboard/components/PropertiesModal';
import {
  UNDO_LIMIT,
  SAVE_TYPE_OVERWRITE,
  DASHBOARD_POSITION_DATA_LIMIT,
  DASHBOARD_HEADER_ID,
} from 'src/dashboard/util/constants';
import setPeriodicRunner, {
  stopPeriodicRender,
} from 'src/dashboard/util/setPeriodicRunner';
import ReportModal from 'src/features/reports/ReportModal';
import DeleteModal from 'src/components/DeleteModal';
import { deleteActiveReport } from 'src/features/reports/ReportModal/actions';
import { PageHeaderWithActions } from 'src/components/PageHeaderWithActions';
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
  updateCss,
} from '../../actions/dashboardState';
import { logEvent } from '../../../logger/actions';
import { dashboardInfoChanged } from '../../actions/dashboardInfo';
import isDashboardLoading from '../../util/isDashboardLoading';
import { useChartIds } from '../../util/charts/useChartIds';
import { useDashboardMetadataBar } from './useDashboardMetadataBar';
import { useHeaderActionsMenu } from './useHeaderActionsDropdownMenu';

const extensionsRegistry = getExtensionsRegistry();

const headerContainerStyle = theme => css`
  border-bottom: 1px solid ${theme.colors.grayscale.light2};
`;

const editButtonStyle = theme => css`
  color: ${theme.colors.primary.dark2};
`;

const actionButtonsStyle = theme => css`
  display: flex;
  align-items: center;

  .action-schedule-report {
    margin-left: ${theme.gridUnit * 2}px;
  }

  .undoRedo {
    display: flex;
    margin-right: ${theme.gridUnit * 2}px;
  }
`;

const StyledUndoRedoButton = styled(Button)`
  // TODO: check if we need this
  padding: 0;
  &:hover {
    background: transparent;
  }
`;

const undoRedoStyle = theme => css`
  color: ${theme.colors.grayscale.light1};
  &:hover {
    color: ${theme.colors.grayscale.base};
  }
`;

const undoRedoEmphasized = theme => css`
  color: ${theme.colors.grayscale.base};
`;

const undoRedoDisabled = theme => css`
  color: ${theme.colors.grayscale.light2};
`;

const saveBtnStyle = theme => css`
  min-width: ${theme.gridUnit * 17}px;
  height: ${theme.gridUnit * 8}px;
`;

const discardBtnStyle = theme => css`
  min-width: ${theme.gridUnit * 22}px;
  height: ${theme.gridUnit * 8}px;
`;

const discardChanges = () => {
  const url = new URL(window.location.href);

  url.searchParams.delete('edit');
  window.location.assign(url);
};

const Header = () => {
  const dispatch = useDispatch();
  const [didNotifyMaxUndoHistoryToast, setDidNotifyMaxUndoHistoryToast] =
    useState(false);
  const [emphasizeUndo, setEmphasizeUndo] = useState(false);
  const [emphasizeRedo, setEmphasizeRedo] = useState(false);
  const [showingPropertiesModal, setShowingPropertiesModal] = useState(false);
  const [showingEmbedModal, setShowingEmbedModal] = useState(false);
  const [showingReportModal, setShowingReportModal] = useState(false);
  const [currentReportDeleting, setCurrentReportDeleting] = useState(null);
  const dashboardInfo = useSelector(state => state.dashboardInfo);
  const layout = useSelector(state => state.dashboardLayout.present);
  const undoLength = useSelector(state => state.dashboardLayout.past.length);
  const redoLength = useSelector(state => state.dashboardLayout.future.length);
  const dataMask = useSelector(state => state.dataMask);
  const user = useSelector(state => state.user);
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
    state => ({
      expandedSlices: state.dashboardState.expandedSlices,
      refreshFrequency: state.dashboardState.refreshFrequency,
      shouldPersistRefreshFrequency:
        !!state.dashboardState.shouldPersistRefreshFrequency,
      customCss: state.dashboardState.css,
      colorNamespace: state.dashboardState.colorNamespace,
      colorScheme: state.dashboardState.colorScheme,
      isStarred: !!state.dashboardState.isStarred,
      isPublished: !!state.dashboardState.isPublished,
      hasUnsavedChanges: !!state.dashboardState.hasUnsavedChanges,
      maxUndoHistoryExceeded: !!state.dashboardState.maxUndoHistoryExceeded,
      editMode: !!state.dashboardState.editMode,
      lastModifiedTime: state.lastModifiedTime,
    }),
    shallowEqual,
  );
  const isLoading = useSelector(state => isDashboardLoading(state.charts));

  const refreshTimer = useRef(0);
  const ctrlYTimeout = useRef(0);
  const ctrlZTimeout = useRef(0);

  const dashboardTitle = layout[DASHBOARD_HEADER_ID]?.meta?.text;
  const { slug } = dashboardInfo;
  const actualLastModifiedTime = Math.max(
    lastModifiedTime,
    dashboardInfo.last_modified_time,
  );
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
          updateCss,
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

  const startPeriodicRender = useCallback(
    interval => {
      let intervalMessage;

      if (interval) {
        const periodicRefreshOptions =
          dashboardInfo.common?.conf?.DASHBOARD_AUTO_REFRESH_INTERVALS;
        const predefinedValue = periodicRefreshOptions.find(
          option => Number(option[0]) === interval / 1000,
        );

        if (predefinedValue) {
          intervalMessage = t(predefinedValue[1]);
        } else {
          intervalMessage = extendedDayjs
            .duration(interval, 'millisecond')
            .humanize();
        }
      }

      const fetchCharts = (charts, force = false) =>
        boundActionCreators.fetchCharts(
          charts,
          force,
          interval * 0.2,
          dashboardInfo.id,
        );

      const periodicRender = () => {
        const { metadata } = dashboardInfo;
        const immune = metadata.timed_refresh_immune_slices || [];
        const affectedCharts = chartIds.filter(
          chartId => immune.indexOf(chartId) === -1,
        );

        boundActionCreators.logEvent(LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD, {
          interval,
          chartCount: affectedCharts.length,
        });
        boundActionCreators.addWarningToast(
          t(
            `This dashboard is currently auto refreshing; the next auto refresh will be in %s.`,
            intervalMessage,
          ),
        );
        if (
          dashboardInfo.common?.conf?.DASHBOARD_AUTO_REFRESH_MODE === 'fetch'
        ) {
          // force-refresh while auto-refresh in dashboard
          return fetchCharts(affectedCharts);
        }
        return fetchCharts(affectedCharts, true);
      };

      refreshTimer.current = setPeriodicRunner({
        interval,
        periodicRender,
        refreshTimer: refreshTimer.current,
      });
    },
    [boundActionCreators, chartIds, dashboardInfo],
  );

  useEffect(() => {
    startPeriodicRender(refreshFrequency * 1000);
  }, [refreshFrequency, startPeriodicRender]);

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
      stopPeriodicRender(refreshTimer.current);
      boundActionCreators.setRefreshFrequency(0);
      clearTimeout(ctrlYTimeout.current);
      clearTimeout(ctrlZTimeout.current);
    },
    [boundActionCreators],
  );

  const handleChangeText = useCallback(
    nextText => {
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
    if (ctrlYTimeout.current) {
      clearTimeout(ctrlYTimeout.current);
    }
    ctrlYTimeout.current = setTimeout(() => {
      setEmphasizeRedo(false);
    }, 100);
  }, [boundActionCreators]);

  const handleCtrlZ = useCallback(() => {
    boundActionCreators.onUndo();
    setEmphasizeUndo(true);
    if (ctrlZTimeout.current) {
      clearTimeout(ctrlZTimeout.current);
    }
    ctrlZTimeout.current = setTimeout(() => {
      setEmphasizeUndo(false);
    }, 100);
  }, [boundActionCreators]);

  const forceRefresh = useCallback(() => {
    if (!isLoading) {
      boundActionCreators.logEvent(LOG_ACTIONS_FORCE_REFRESH_DASHBOARD, {
        force: true,
        interval: 0,
        chartCount: chartIds.length,
      });
      return boundActionCreators.onRefresh(chartIds, true, 0, dashboardInfo.id);
    }
    return false;
  }, [boundActionCreators, chartIds, dashboardInfo.id, isLoading]);

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
    dashboardTitle,
    layout,
    refreshFrequency,
    shouldPersistRefreshFrequency,
    slug,
  ]);

  const showPropertiesModal = useCallback(() => {
    setShowingPropertiesModal(true);
  }, []);

  const hidePropertiesModal = useCallback(() => {
    setShowingPropertiesModal(false);
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
  const userCanShare = dashboardInfo.dash_share_perm;
  const userCanSaveAs = dashboardInfo.dash_save_perm;
  const userCanCurate =
    isFeatureEnabled(FeatureFlag.EmbeddedSuperset) &&
    findPermission('can_set_embedded', 'Dashboard', user.roles);
  const refreshLimit =
    dashboardInfo.common?.conf?.SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT;
  const refreshWarning =
    dashboardInfo.common?.conf
      ?.SUPERSET_DASHBOARD_PERIODICAL_REFRESH_WARNING_MESSAGE;
  const isEmbedded = !dashboardInfo?.userId;

  const handleOnPropertiesChange = useCallback(
    updates => {
      boundActionCreators.dashboardInfoChanged({
        slug: updates.slug,
        metadata: JSON.parse(updates.jsonMetadata || '{}'),
        certified_by: updates.certifiedBy,
        certification_details: updates.certificationDetails,
        owners: updates.owners,
        roles: updates.roles,
      });
      boundActionCreators.setUnsavedChanges(true);
      boundActionCreators.dashboardTitleChanged(updates.title);
    },
    [boundActionCreators],
  );

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
        <PublishedStatus
          dashboardId={dashboardInfo.id}
          isPublished={isPublished}
          savePublished={boundActionCreators.savePublished}
          userCanEdit={userCanEdit}
          userCanSave={userCanSaveAs}
          visible={!editMode}
        />
      ),
      !editMode && !isEmbedded && metadataBar,
    ],
    [
      boundActionCreators.savePublished,
      dashboardInfo.id,
      editMode,
      metadataBar,
      isEmbedded,
      isPublished,
      userCanEdit,
      userCanSaveAs,
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
                      onClick={undoLength && boundActionCreators.onUndo}
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
                      onClick={redoLength && boundActionCreators.onRedo}
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
                  buttonStyle="default"
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
            {userCanEdit && (
              <Button
                buttonStyle="secondary"
                onClick={() => {
                  toggleEditMode();
                  boundActionCreators.clearDashboardHistory?.(); // Resets the `past` as an empty array
                }}
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
      boundActionCreators.clearDashboardHistory,
      editMode,
      emphasizeRedo,
      emphasizeUndo,
      handleCtrlY,
      handleCtrlZ,
      hasUnsavedChanges,
      overwriteDashboard,
      redoLength,
      toggleEditMode,
      undoLength,
      userCanEdit,
      userCanSaveAs,
    ],
  );

  const handleReportDelete = async report => {
    await dispatch(deleteActiveReport(report));
    setCurrentReportDeleting(null);
  };

  const [menu, isDropdownVisible, setIsDropdownVisible] = useHeaderActionsMenu({
    addSuccessToast: boundActionCreators.addSuccessToast,
    addDangerToast: boundActionCreators.addDangerToast,
    dashboardInfo,
    dashboardId: dashboardInfo.id,
    dashboardTitle,
    dataMask,
    layout,
    expandedSlices,
    customCss,
    colorNamespace,
    colorScheme,
    onSave: boundActionCreators.onSave,
    onChange: boundActionCreators.onChange,
    forceRefreshAllCharts: forceRefresh,
    startPeriodicRender,
    refreshFrequency,
    shouldPersistRefreshFrequency,
    setRefreshFrequency: boundActionCreators.setRefreshFrequency,
    updateCss: boundActionCreators.updateCss,
    editMode,
    hasUnsavedChanges,
    userCanEdit,
    userCanShare,
    userCanSave: userCanSaveAs,
    userCanCurate,
    isLoading,
    showReportModal,
    showPropertiesModal,
    setCurrentReportDeleting,
    manageEmbedded: showEmbedModal,
    refreshLimit,
    refreshWarning,
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
        titlePanelAdditionalItems={titlePanelAdditionalItems}
        rightPanelAdditionalItems={rightPanelAdditionalItems}
        menuDropdownProps={{
          open: isDropdownVisible,
          onOpenChange: setIsDropdownVisible,
        }}
        additionalActionsMenu={menu}
        showFaveStar={user?.userId && dashboardInfo?.id}
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
          dashboardId={dashboardInfo.id}
        />
      )}
      <Global
        styles={css`
          .antd5-menu-vertical {
            border-right: none;
          }
        `}
      />
    </div>
  );
};

export default Header;
