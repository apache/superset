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
import moment from 'moment';
import React from 'react';
import PropTypes from 'prop-types';
import {
  styled,
  css,
  t,
  getSharedLabelColor,
  getUiOverrideRegistry,
} from '@superset-ui/core';
import { Global } from '@emotion/react';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
import {
  LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD,
  LOG_ACTIONS_FORCE_REFRESH_DASHBOARD,
  LOG_ACTIONS_TOGGLE_EDIT_DASHBOARD,
} from 'src/logger/LogUtils';
import Icons from 'src/components/Icons';
import Button from 'src/components/Button';
import { AntdButton } from 'src/components/';
import { findPermission } from 'src/utils/findPermission';
import { Tooltip } from 'src/components/Tooltip';
import { safeStringify } from 'src/utils/safeStringify';
import HeaderActionsDropdown from 'src/dashboard/components/Header/HeaderActionsDropdown';
import PublishedStatus from 'src/dashboard/components/PublishedStatus';
import UndoRedoKeyListeners from 'src/dashboard/components/UndoRedoKeyListeners';
import PropertiesModal from 'src/dashboard/components/PropertiesModal';
import { chartPropShape } from 'src/dashboard/util/propShapes';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import {
  UNDO_LIMIT,
  SAVE_TYPE_OVERWRITE,
  DASHBOARD_POSITION_DATA_LIMIT,
} from 'src/dashboard/util/constants';
import setPeriodicRunner, {
  stopPeriodicRender,
} from 'src/dashboard/util/setPeriodicRunner';
import { options as PeriodicRefreshOptions } from 'src/dashboard/components/RefreshIntervalModal';
import { FILTER_BOX_MIGRATION_STATES } from 'src/explore/constants';
import { PageHeaderWithActions } from 'src/components/PageHeaderWithActions';
import { DashboardEmbedModal } from '../DashboardEmbedControls';

const uiOverrideRegistry = getUiOverrideRegistry();

const propTypes = {
  addSuccessToast: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  addWarningToast: PropTypes.func.isRequired,
  user: UserWithPermissionsAndRoles,
  dashboardInfo: PropTypes.object.isRequired,
  dashboardTitle: PropTypes.string.isRequired,
  dataMask: PropTypes.object.isRequired,
  charts: PropTypes.objectOf(chartPropShape).isRequired,
  layout: PropTypes.object.isRequired,
  expandedSlices: PropTypes.object.isRequired,
  customCss: PropTypes.string.isRequired,
  colorNamespace: PropTypes.string,
  colorScheme: PropTypes.string,
  setColorSchemeAndUnsavedChanges: PropTypes.func.isRequired,
  isStarred: PropTypes.bool.isRequired,
  isPublished: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  fetchFaveStar: PropTypes.func.isRequired,
  fetchCharts: PropTypes.func.isRequired,
  saveFaveStar: PropTypes.func.isRequired,
  savePublished: PropTypes.func.isRequired,
  updateDashboardTitle: PropTypes.func.isRequired,
  editMode: PropTypes.bool.isRequired,
  setEditMode: PropTypes.func.isRequired,
  showBuilderPane: PropTypes.func.isRequired,
  updateCss: PropTypes.func.isRequired,
  logEvent: PropTypes.func.isRequired,
  hasUnsavedChanges: PropTypes.bool.isRequired,
  maxUndoHistoryExceeded: PropTypes.bool.isRequired,
  lastModifiedTime: PropTypes.number.isRequired,

  // redux
  onRefresh: PropTypes.func.isRequired,
  onUndo: PropTypes.func.isRequired,
  onRedo: PropTypes.func.isRequired,
  undoLength: PropTypes.number.isRequired,
  redoLength: PropTypes.number.isRequired,
  setMaxUndoHistoryExceeded: PropTypes.func.isRequired,
  maxUndoHistoryToast: PropTypes.func.isRequired,
  refreshFrequency: PropTypes.number.isRequired,
  shouldPersistRefreshFrequency: PropTypes.bool.isRequired,
  setRefreshFrequency: PropTypes.func.isRequired,
  dashboardInfoChanged: PropTypes.func.isRequired,
  dashboardTitleChanged: PropTypes.func.isRequired,
};

const defaultProps = {
  colorNamespace: undefined,
  colorScheme: undefined,
};

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

const StyledUndoRedoButton = styled(AntdButton)`
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

class Header extends React.PureComponent {
  static discardChanges() {
    const url = new URL(window.location.href);

    url.searchParams.delete('edit');
    window.location.assign(url);
  }

  constructor(props) {
    super(props);
    this.state = {
      didNotifyMaxUndoHistoryToast: false,
      emphasizeUndo: false,
      emphasizeRedo: false,
      showingPropertiesModal: false,
      isDropdownVisible: false,
    };

    this.handleChangeText = this.handleChangeText.bind(this);
    this.handleCtrlZ = this.handleCtrlZ.bind(this);
    this.handleCtrlY = this.handleCtrlY.bind(this);
    this.toggleEditMode = this.toggleEditMode.bind(this);
    this.forceRefresh = this.forceRefresh.bind(this);
    this.startPeriodicRender = this.startPeriodicRender.bind(this);
    this.overwriteDashboard = this.overwriteDashboard.bind(this);
    this.showPropertiesModal = this.showPropertiesModal.bind(this);
    this.hidePropertiesModal = this.hidePropertiesModal.bind(this);
    this.setIsDropdownVisible = this.setIsDropdownVisible.bind(this);
  }

  componentDidMount() {
    const { refreshFrequency } = this.props;
    this.startPeriodicRender(refreshFrequency * 1000);
  }

  componentDidUpdate(prevProps) {
    if (this.props.refreshFrequency !== prevProps.refreshFrequency) {
      const { refreshFrequency } = this.props;
      this.startPeriodicRender(refreshFrequency * 1000);
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (
      UNDO_LIMIT - nextProps.undoLength <= 0 &&
      !this.state.didNotifyMaxUndoHistoryToast
    ) {
      this.setState(() => ({ didNotifyMaxUndoHistoryToast: true }));
      this.props.maxUndoHistoryToast();
    }
    if (
      nextProps.undoLength > UNDO_LIMIT &&
      !this.props.maxUndoHistoryExceeded
    ) {
      this.props.setMaxUndoHistoryExceeded();
    }
  }

  componentWillUnmount() {
    stopPeriodicRender(this.refreshTimer);
    this.props.setRefreshFrequency(0);
    clearTimeout(this.ctrlYTimeout);
    clearTimeout(this.ctrlZTimeout);
  }

  handleChangeText(nextText) {
    const { updateDashboardTitle, onChange } = this.props;
    if (nextText && this.props.dashboardTitle !== nextText) {
      updateDashboardTitle(nextText);
      onChange();
    }
  }

  setIsDropdownVisible(visible) {
    this.setState({
      isDropdownVisible: visible,
    });
  }

  handleCtrlY() {
    this.props.onRedo();
    this.setState({ emphasizeRedo: true }, () => {
      if (this.ctrlYTimeout) clearTimeout(this.ctrlYTimeout);
      this.ctrlYTimeout = setTimeout(() => {
        this.setState({ emphasizeRedo: false });
      }, 100);
    });
  }

  handleCtrlZ() {
    this.props.onUndo();
    this.setState({ emphasizeUndo: true }, () => {
      if (this.ctrlZTimeout) clearTimeout(this.ctrlZTimeout);
      this.ctrlZTimeout = setTimeout(() => {
        this.setState({ emphasizeUndo: false });
      }, 100);
    });
  }

  forceRefresh() {
    if (!this.props.isLoading) {
      const chartList = Object.keys(this.props.charts);
      this.props.logEvent(LOG_ACTIONS_FORCE_REFRESH_DASHBOARD, {
        force: true,
        interval: 0,
        chartCount: chartList.length,
      });
      return this.props.onRefresh(
        chartList,
        true,
        0,
        this.props.dashboardInfo.id,
      );
    }
    return false;
  }

  startPeriodicRender(interval) {
    let intervalMessage;
    if (interval) {
      const predefinedValue = PeriodicRefreshOptions.find(
        option => option.value === interval / 1000,
      );
      if (predefinedValue) {
        intervalMessage = predefinedValue.label;
      } else {
        intervalMessage = moment.duration(interval, 'millisecond').humanize();
      }
    }

    const periodicRender = () => {
      const { fetchCharts, logEvent, charts, dashboardInfo } = this.props;
      const { metadata } = dashboardInfo;
      const immune = metadata.timed_refresh_immune_slices || [];
      const affectedCharts = Object.values(charts)
        .filter(chart => immune.indexOf(chart.id) === -1)
        .map(chart => chart.id);

      logEvent(LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD, {
        interval,
        chartCount: affectedCharts.length,
      });
      this.props.addWarningToast(
        t(
          `This dashboard is currently auto refreshing; the next auto refresh will be in %s.`,
          intervalMessage,
        ),
      );
      if (dashboardInfo.common.conf.DASHBOARD_AUTO_REFRESH_MODE === 'fetch') {
        // force-refresh while auto-refresh in dashboard
        return fetchCharts(
          affectedCharts,
          false,
          interval * 0.2,
          dashboardInfo.id,
        );
      }
      return fetchCharts(
        affectedCharts,
        true,
        interval * 0.2,
        dashboardInfo.id,
      );
    };

    this.refreshTimer = setPeriodicRunner({
      interval,
      periodicRender,
      refreshTimer: this.refreshTimer,
    });
  }

  toggleEditMode() {
    this.props.logEvent(LOG_ACTIONS_TOGGLE_EDIT_DASHBOARD, {
      edit_mode: !this.props.editMode,
    });
    this.props.setEditMode(!this.props.editMode);
  }

  overwriteDashboard() {
    const {
      dashboardTitle,
      layout: positions,
      colorScheme,
      colorNamespace,
      customCss,
      dashboardInfo,
      refreshFrequency: currentRefreshFrequency,
      shouldPersistRefreshFrequency,
      lastModifiedTime,
      slug,
    } = this.props;

    // check refresh frequency is for current session or persist
    const refreshFrequency = shouldPersistRefreshFrequency
      ? currentRefreshFrequency
      : dashboardInfo.metadata?.refresh_frequency;

    const currentColorScheme =
      dashboardInfo?.metadata?.color_scheme || colorScheme;
    const currentColorNamespace =
      dashboardInfo?.metadata?.color_namespace || colorNamespace;
    const currentSharedLabelColors = getSharedLabelColor().getColorMap(
      currentColorNamespace,
      currentColorScheme,
    );

    const data = {
      certified_by: dashboardInfo.certified_by,
      certification_details: dashboardInfo.certification_details,
      css: customCss,
      dashboard_title: dashboardTitle,
      last_modified_time: lastModifiedTime,
      owners: dashboardInfo.owners,
      roles: dashboardInfo.roles,
      slug,
      metadata: {
        ...dashboardInfo?.metadata,
        color_namespace: currentColorNamespace,
        color_scheme: currentColorScheme,
        positions,
        refresh_frequency: refreshFrequency,
        shared_label_colors: currentSharedLabelColors,
      },
    };

    // make sure positions data less than DB storage limitation:
    const positionJSONLength = safeStringify(positions).length;
    const limit =
      dashboardInfo.common.conf.SUPERSET_DASHBOARD_POSITION_DATA_LIMIT ||
      DASHBOARD_POSITION_DATA_LIMIT;
    if (positionJSONLength >= limit) {
      this.props.addDangerToast(
        t(
          'Your dashboard is too large. Please reduce its size before saving it.',
        ),
      );
    } else {
      if (positionJSONLength >= limit * 0.9) {
        this.props.addWarningToast('Your dashboard is near the size limit.');
      }

      this.props.onSave(data, dashboardInfo.id, SAVE_TYPE_OVERWRITE);
    }
  }

  showPropertiesModal() {
    this.setState({ showingPropertiesModal: true });
  }

  hidePropertiesModal() {
    this.setState({ showingPropertiesModal: false });
  }

  showEmbedModal = () => {
    this.setState({ showingEmbedModal: true });
  };

  hideEmbedModal = () => {
    this.setState({ showingEmbedModal: false });
  };

  render() {
    const {
      dashboardTitle,
      layout,
      expandedSlices,
      customCss,
      colorNamespace,
      dataMask,
      setColorSchemeAndUnsavedChanges,
      colorScheme,
      onUndo,
      onRedo,
      undoLength,
      redoLength,
      onChange,
      onSave,
      updateCss,
      editMode,
      isPublished,
      user,
      dashboardInfo,
      hasUnsavedChanges,
      isLoading,
      refreshFrequency,
      shouldPersistRefreshFrequency,
      setRefreshFrequency,
      lastModifiedTime,
      filterboxMigrationState,
    } = this.props;

    const userCanEdit =
      dashboardInfo.dash_edit_perm &&
      filterboxMigrationState !== FILTER_BOX_MIGRATION_STATES.REVIEWING &&
      !dashboardInfo.is_managed_externally;
    const userCanShare = dashboardInfo.dash_share_perm;
    const userCanSaveAs =
      dashboardInfo.dash_save_perm &&
      filterboxMigrationState !== FILTER_BOX_MIGRATION_STATES.REVIEWING;
    const userCanCurate =
      isFeatureEnabled(FeatureFlag.EMBEDDED_SUPERSET) &&
      findPermission('can_set_embedded', 'Dashboard', user.roles);
    const refreshLimit =
      dashboardInfo.common?.conf?.SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT;
    const refreshWarning =
      dashboardInfo.common?.conf
        ?.SUPERSET_DASHBOARD_PERIODICAL_REFRESH_WARNING_MESSAGE;

    const handleOnPropertiesChange = updates => {
      const { dashboardInfoChanged, dashboardTitleChanged } = this.props;
      dashboardInfoChanged({
        slug: updates.slug,
        metadata: JSON.parse(updates.jsonMetadata || '{}'),
        certified_by: updates.certifiedBy,
        certification_details: updates.certificationDetails,
        owners: updates.owners,
        roles: updates.roles,
      });
      setColorSchemeAndUnsavedChanges(updates.colorScheme);
      dashboardTitleChanged(updates.title);
    };

    const NavExtension = uiOverrideRegistry.get('dashboard.nav.right');

    return (
      <div
        css={headerContainerStyle}
        data-test="dashboard-header-container"
        data-test-id={dashboardInfo.id}
        className="dashboard-header-container"
      >
        <PageHeaderWithActions
          editableTitleProps={{
            title: dashboardTitle,
            canEdit: userCanEdit && editMode,
            onSave: this.handleChangeText,
            placeholder: t('Add the name of the dashboard'),
            label: t('Dashboard title'),
            showTooltip: false,
          }}
          certificatiedBadgeProps={{
            certifiedBy: dashboardInfo.certified_by,
            details: dashboardInfo.certification_details,
          }}
          faveStarProps={{
            itemId: dashboardInfo.id,
            fetchFaveStar: this.props.fetchFaveStar,
            saveFaveStar: this.props.saveFaveStar,
            isStarred: this.props.isStarred,
            showTooltip: true,
          }}
          titlePanelAdditionalItems={
            <PublishedStatus
              dashboardId={dashboardInfo.id}
              isPublished={isPublished}
              savePublished={this.props.savePublished}
              canEdit={userCanEdit}
              canSave={userCanSaveAs}
            />
          }
          rightPanelAdditionalItems={
            <div className="button-container">
              {userCanSaveAs && (
                <div
                  className="button-container"
                  data-test="dashboard-edit-actions"
                >
                  {editMode && (
                    <div css={actionButtonsStyle}>
                      <div className="undoRedo">
                        <Tooltip
                          id="dashboard-undo-tooltip"
                          title={t('Undo the action')}
                        >
                          <StyledUndoRedoButton
                            type="text"
                            disabled={undoLength < 1}
                          >
                            <Icons.Undo
                              css={[
                                undoRedoStyle,
                                this.state.emphasizeUndo && undoRedoEmphasized,
                                undoLength < 1 && undoRedoDisabled,
                              ]}
                              onClick={undoLength && onUndo}
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
                            type="text"
                            disabled={redoLength < 1}
                          >
                            <Icons.Redo
                              css={[
                                undoRedoStyle,
                                this.state.emphasizeRedo && undoRedoEmphasized,
                                redoLength < 1 && undoRedoDisabled,
                              ]}
                              onClick={redoLength && onRedo}
                              data-test="redo-action"
                              iconSize="xl"
                            />
                          </StyledUndoRedoButton>
                        </Tooltip>
                      </div>
                      <Button
                        css={discardBtnStyle}
                        buttonSize="small"
                        onClick={this.constructor.discardChanges}
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
                        onClick={this.overwriteDashboard}
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
                <UndoRedoKeyListeners
                  onUndo={this.handleCtrlZ}
                  onRedo={this.handleCtrlY}
                />
              ) : (
                <div css={actionButtonsStyle}>
                  {NavExtension && <NavExtension />}
                  {userCanEdit && (
                    <Button
                      buttonStyle="secondary"
                      onClick={this.toggleEditMode}
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
          }
          menuDropdownProps={{
            getPopupContainer: triggerNode =>
              triggerNode.closest('.header-with-actions'),
            visible: this.state.isDropdownVisible,
            onVisibleChange: this.setIsDropdownVisible,
          }}
          additionalActionsMenu={
            <HeaderActionsDropdown
              addSuccessToast={this.props.addSuccessToast}
              addDangerToast={this.props.addDangerToast}
              dashboardId={dashboardInfo.id}
              dashboardTitle={dashboardTitle}
              dashboardInfo={dashboardInfo}
              dataMask={dataMask}
              layout={layout}
              expandedSlices={expandedSlices}
              customCss={customCss}
              colorNamespace={colorNamespace}
              colorScheme={colorScheme}
              onSave={onSave}
              onChange={onChange}
              forceRefreshAllCharts={this.forceRefresh}
              startPeriodicRender={this.startPeriodicRender}
              refreshFrequency={refreshFrequency}
              shouldPersistRefreshFrequency={shouldPersistRefreshFrequency}
              setRefreshFrequency={setRefreshFrequency}
              updateCss={updateCss}
              editMode={editMode}
              hasUnsavedChanges={hasUnsavedChanges}
              userCanEdit={userCanEdit}
              userCanShare={userCanShare}
              userCanSave={userCanSaveAs}
              userCanCurate={userCanCurate}
              isLoading={isLoading}
              showPropertiesModal={this.showPropertiesModal}
              manageEmbedded={this.showEmbedModal}
              refreshLimit={refreshLimit}
              refreshWarning={refreshWarning}
              lastModifiedTime={lastModifiedTime}
              filterboxMigrationState={filterboxMigrationState}
              isDropdownVisible={this.state.isDropdownVisible}
              setIsDropdownVisible={this.setIsDropdownVisible}
            />
          }
          showFaveStar={user?.userId && dashboardInfo?.id}
          showTitlePanelItems={!editMode}
        />
        {this.state.showingPropertiesModal && (
          <PropertiesModal
            dashboardId={dashboardInfo.id}
            dashboardInfo={dashboardInfo}
            dashboardTitle={dashboardTitle}
            show={this.state.showingPropertiesModal}
            onHide={this.hidePropertiesModal}
            colorScheme={this.props.colorScheme}
            onSubmit={handleOnPropertiesChange}
            onlyApply
          />
        )}

        {userCanCurate && (
          <DashboardEmbedModal
            show={this.state.showingEmbedModal}
            onHide={this.hideEmbedModal}
            dashboardId={dashboardInfo.id}
          />
        )}
        <Global
          styles={css`
            .ant-menu-vertical {
              border-right: none;
            }
          `}
        />
      </div>
    );
  }
}

Header.propTypes = propTypes;
Header.defaultProps = defaultProps;

export default Header;
