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
import { styled, CategoricalColorNamespace, t } from '@superset-ui/core';
import ButtonGroup from 'src/components/ButtonGroup';

import {
  LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD,
  LOG_ACTIONS_FORCE_REFRESH_DASHBOARD,
  LOG_ACTIONS_TOGGLE_EDIT_DASHBOARD,
} from 'src/logger/LogUtils';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';

import Icons from 'src/components/Icons';
import Button from 'src/components/Button';
import EditableTitle from 'src/components/EditableTitle';
import FaveStar from 'src/components/FaveStar';
import { safeStringify } from 'src/utils/safeStringify';
import HeaderActionsDropdown from 'src/dashboard/components/Header/HeaderActionsDropdown';
import HeaderReportActionsDropdown from 'src/components/ReportModal/HeaderReportActionsDropdown';
import PublishedStatus from 'src/dashboard/components/PublishedStatus';
import UndoRedoKeyListeners from 'src/dashboard/components/UndoRedoKeyListeners';
import PropertiesModal from 'src/dashboard/components/PropertiesModal';
import ReportModal from 'src/components/ReportModal';
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
  fetchUISpecificReport: PropTypes.func.isRequired,
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

// Styled Components
const StyledDashboardHeader = styled.div`
  background: ${({ theme }) => theme.colors.grayscale.light5};
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${({ theme }) => theme.gridUnit * 6}px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};

  .action-button > span {
    color: ${({ theme }) => theme.colors.grayscale.base};
  }
  button,
  .fave-unfave-icon {
    margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  }
  .button-container {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    .action-button {
      font-size: ${({ theme }) => theme.typography.sizes.xl}px;
      margin-left: ${({ theme }) => theme.gridUnit * 2.5}px;
    }
  }
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
      showingPropertiesModal: false,
      showingReportModal: false,
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
    this.showReportModal = this.showReportModal.bind(this);
    this.hideReportModal = this.hideReportModal.bind(this);
    this.renderReportModal = this.renderReportModal.bind(this);
  }

  componentDidMount() {
    const { refreshFrequency, user, dashboardInfo } = this.props;
    this.startPeriodicRender(refreshFrequency * 1000);
    if (this.canAddReports()) {
      // this is in case there is an anonymous user.
      this.props.fetchUISpecificReport(
        user.userId,
        'dashboard_id',
        'dashboards',
        dashboardInfo.id,
        user.email,
      );
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.refreshFrequency !== prevProps.refreshFrequency) {
      const { refreshFrequency } = this.props;
      this.startPeriodicRender(refreshFrequency * 1000);
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const { user } = this.props;
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
    if (
      this.canAddReports() &&
      nextProps.dashboardInfo.id !== this.props.dashboardInfo.id
    ) {
      // this is in case there is an anonymous user.
      this.props.fetchUISpecificReport(
        user.userId,
        'dashboard_id',
        'dashboards',
        nextProps.dashboardInfo.id,
        user.email,
      );
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
      expandedSlices,
      customCss,
      colorNamespace,
      colorScheme,
      dashboardInfo,
      refreshFrequency: currentRefreshFrequency,
      shouldPersistRefreshFrequency,
      lastModifiedTime,
    } = this.props;

    const scale = CategoricalColorNamespace.getScale(
      colorScheme,
      colorNamespace,
    );

    // use the colorScheme for default labels
    let labelColors = colorScheme ? scale.getColorMap() : {};
    // but allow metadata to overwrite if it exists
    // eslint-disable-next-line camelcase
    const metadataLabelColors = dashboardInfo.metadata?.label_colors;
    if (metadataLabelColors) {
      labelColors = { ...labelColors, ...metadataLabelColors };
    }

    // check refresh frequency is for current session or persist
    const refreshFrequency = shouldPersistRefreshFrequency
      ? currentRefreshFrequency
      : dashboardInfo.metadata?.refresh_frequency; // eslint-disable-line camelcase

    const data = {
      positions,
      expanded_slices: expandedSlices,
      css: customCss,
      color_namespace: colorNamespace,
      color_scheme: colorScheme,
      label_colors: labelColors,
      dashboard_title: dashboardTitle,
      refresh_frequency: refreshFrequency,
      last_modified_time: lastModifiedTime,
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

  showReportModal() {
    this.setState({ showingReportModal: true });
  }

  hideReportModal() {
    this.setState({ showingReportModal: false });
  }

  renderReportModal() {
    const attachedReportExists = !!Object.keys(this.props.reports).length;
    return attachedReportExists ? (
      <HeaderReportActionsDropdown
        showReportModal={this.showReportModal}
        toggleActive={this.props.toggleActive}
        deleteActiveReport={this.props.deleteActiveReport}
      />
    ) : (
      <>
        <span
          role="button"
          title={t('Schedule email report')}
          tabIndex={0}
          className="action-button"
          onClick={this.showReportModal}
        >
          <Icons.Calendar />
        </span>
      </>
    );
  }

  canAddReports() {
    if (!isFeatureEnabled(FeatureFlag.ALERT_REPORTS)) {
      return false;
    }
    const { user } = this.props;
    if (!user) {
      // this is in the case that there is an anonymous user.
      return false;
    }
    const roles = Object.keys(user.roles || []);
    const permissions = roles.map(key =>
      user.roles[key].filter(
        perms => perms[0] === 'menu_access' && perms[1] === 'Manage',
      ),
    );
    return permissions[0].length > 0;
  }

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
    } = this.props;
    const userCanEdit = dashboardInfo.dash_edit_perm;
    const userCanShare = dashboardInfo.dash_share_perm;
    const userCanSaveAs = dashboardInfo.dash_save_perm;
    const shouldShowReport = !editMode && this.canAddReports();
    const refreshLimit =
      dashboardInfo.common.conf.SUPERSET_DASHBOARD_PERIODICAL_REFRESH_LIMIT;
    const refreshWarning =
      dashboardInfo.common.conf
        .SUPERSET_DASHBOARD_PERIODICAL_REFRESH_WARNING_MESSAGE;

    return (
      <StyledDashboardHeader
        className="dashboard-header"
        data-test="dashboard-header"
        data-test-id={`${dashboardInfo.id}`}
      >
        <div className="dashboard-component-header header-large">
          <EditableTitle
            title={dashboardTitle}
            canEdit={userCanEdit && editMode}
            onSaveTitle={this.handleChangeText}
            showTooltip={false}
          />
          <PublishedStatus
            dashboardId={dashboardInfo.id}
            isPublished={isPublished}
            savePublished={this.props.savePublished}
            canEdit={userCanEdit}
            canSave={userCanSaveAs}
          />
          {user?.userId && (
            <FaveStar
              itemId={dashboardInfo.id}
              fetchFaveStar={this.props.fetchFaveStar}
              saveFaveStar={this.props.saveFaveStar}
              isStarred={this.props.isStarred}
              showTooltip
            />
          )}
        </div>

        <div className="button-container">
          {userCanSaveAs && (
            <div
              className="button-container"
              data-test="dashboard-edit-actions"
            >
              {editMode && (
                <>
                  <ButtonGroup className="m-r-5">
                    <Button
                      buttonSize="small"
                      onClick={onUndo}
                      disabled={undoLength < 1}
                      buttonStyle={
                        this.state.emphasizeUndo ? 'primary' : undefined
                      }
                      showMarginRight={false}
                    >
                      <i
                        title="Undo"
                        className="undo-action fa fa-reply"
                        data-test="undo-action"
                      />
                      &nbsp;
                    </Button>
                    <Button
                      buttonSize="small"
                      onClick={onRedo}
                      disabled={redoLength < 1}
                      buttonStyle={
                        this.state.emphasizeRedo ? 'primary' : undefined
                      }
                      showMarginRight={false}
                    >
                      &nbsp;
                      <i title="Redo" className="redo-action fa fa-share" />
                    </Button>
                  </ButtonGroup>
                  <Button
                    buttonSize="small"
                    className="m-r-5"
                    onClick={this.constructor.discardChanges}
                    buttonStyle="default"
                    data-test="discard-changes-button"
                  >
                    {t('Discard changes')}
                  </Button>
                  <Button
                    buttonSize="small"
                    disabled={!hasUnsavedChanges}
                    buttonStyle="primary"
                    onClick={this.overwriteDashboard}
                    data-test="header-save-button"
                  >
                    {t('Save')}
                  </Button>
                </>
              )}
            </div>
          )}
          {editMode && (
            <UndoRedoKeyListeners
              onUndo={this.handleCtrlZ}
              onRedo={this.handleCtrlY}
            />
          )}

          {!editMode && userCanEdit && (
            <>
              <span
                role="button"
                title={t('Edit dashboard')}
                tabIndex={0}
                className="action-button"
                onClick={this.toggleEditMode}
              >
                <Icons.EditAlt />
              </span>
            </>
          )}
          {shouldShowReport && this.renderReportModal()}

          {this.state.showingPropertiesModal && (
            <PropertiesModal
              dashboardId={dashboardInfo.id}
              show={this.state.showingPropertiesModal}
              onHide={this.hidePropertiesModal}
              colorScheme={this.props.colorScheme}
              onSubmit={updates => {
                const {
                  dashboardInfoChanged,
                  dashboardTitleChanged,
                } = this.props;
                dashboardInfoChanged({
                  slug: updates.slug,
                  metadata: JSON.parse(updates.jsonMetadata),
                });
                setColorSchemeAndUnsavedChanges(updates.colorScheme);
                dashboardTitleChanged(updates.title);
                if (updates.slug) {
                  window.history.pushState(
                    { event: 'dashboard_properties_changed' },
                    '',
                    `/superset/dashboard/${updates.slug}/`,
                  );
                }
              }}
            />
          )}

          {this.state.showingReportModal && (
            <ReportModal
              show={this.state.showingReportModal}
              onHide={this.hideReportModal}
              props={{
                userId: user.userId,
                userEmail: user.email,
                dashboardId: dashboardInfo.id,
                creationMethod: 'dashboards',
              }}
            />
          )}

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
            isLoading={isLoading}
            showPropertiesModal={this.showPropertiesModal}
            refreshLimit={refreshLimit}
            refreshWarning={refreshWarning}
            lastModifiedTime={lastModifiedTime}
          />
        </div>
      </StyledDashboardHeader>
    );
  }
}

Header.propTypes = propTypes;
Header.defaultProps = defaultProps;

export default Header;
