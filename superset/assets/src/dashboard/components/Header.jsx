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
import React from 'react';
import PropTypes from 'prop-types';
import { CategoricalColorNamespace } from '@superset-ui/color';
import { t } from '@superset-ui/translation';

import HeaderActionsDropdown from './HeaderActionsDropdown';
import EditableTitle from '../../components/EditableTitle';
import Button from '../../components/Button';
import FaveStar from '../../components/FaveStar';
import UndoRedoKeylisteners from './UndoRedoKeylisteners';

import { chartPropShape } from '../util/propShapes';
import {
  BUILDER_PANE_TYPE,
  UNDO_LIMIT,
  SAVE_TYPE_OVERWRITE,
  DASHBOARD_POSITION_DATA_LIMIT,
} from '../util/constants';
import { safeStringify } from '../../utils/safeStringify';

import {
  LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD,
  LOG_ACTIONS_FORCE_REFRESH_DASHBOARD,
  LOG_ACTIONS_TOGGLE_EDIT_DASHBOARD,
} from '../../logger/LogUtils';

const propTypes = {
  addSuccessToast: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  addWarningToast: PropTypes.func.isRequired,
  dashboardInfo: PropTypes.object.isRequired,
  dashboardTitle: PropTypes.string.isRequired,
  charts: PropTypes.objectOf(chartPropShape).isRequired,
  layout: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  expandedSlices: PropTypes.object.isRequired,
  css: PropTypes.string.isRequired,
  colorNamespace: PropTypes.string,
  colorScheme: PropTypes.string,
  isStarred: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  fetchFaveStar: PropTypes.func.isRequired,
  fetchCharts: PropTypes.func.isRequired,
  saveFaveStar: PropTypes.func.isRequired,
  startPeriodicRender: PropTypes.func.isRequired,
  updateDashboardTitle: PropTypes.func.isRequired,
  editMode: PropTypes.bool.isRequired,
  setEditMode: PropTypes.func.isRequired,
  showBuilderPane: PropTypes.func.isRequired,
  builderPaneType: PropTypes.string.isRequired,
  updateCss: PropTypes.func.isRequired,
  logEvent: PropTypes.func.isRequired,
  hasUnsavedChanges: PropTypes.bool.isRequired,
  maxUndoHistoryExceeded: PropTypes.bool.isRequired,

  // redux
  onUndo: PropTypes.func.isRequired,
  onRedo: PropTypes.func.isRequired,
  undoLength: PropTypes.number.isRequired,
  redoLength: PropTypes.number.isRequired,
  setMaxUndoHistoryExceeded: PropTypes.func.isRequired,
  maxUndoHistoryToast: PropTypes.func.isRequired,
  refreshFrequency: PropTypes.number.isRequired,
  setRefreshFrequency: PropTypes.func.isRequired,
};

const defaultProps = {
  colorNamespace: undefined,
  colorScheme: undefined,
};

class Header extends React.PureComponent {
  static discardChanges() {
    window.location.reload();
  }

  constructor(props) {
    super(props);
    this.state = {
      didNotifyMaxUndoHistoryToast: false,
      emphasizeUndo: false,
    };

    this.handleChangeText = this.handleChangeText.bind(this);
    this.handleCtrlZ = this.handleCtrlZ.bind(this);
    this.handleCtrlY = this.handleCtrlY.bind(this);
    this.onInsertComponentsButtonClick = this.onInsertComponentsButtonClick.bind(
      this,
    );
    this.onColorsButtonClick = this.onColorsButtonClick.bind(this);
    this.toggleEditMode = this.toggleEditMode.bind(this);
    this.forceRefresh = this.forceRefresh.bind(this);
    this.startPeriodicRender = this.startPeriodicRender.bind(this);
    this.overwriteDashboard = this.overwriteDashboard.bind(this);
  }

  componentDidMount() {
    const refreshFrequency = this.props.refreshFrequency;
    this.props.startPeriodicRender(refreshFrequency * 1000);
  }

  componentWillReceiveProps(nextProps) {
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
    clearTimeout(this.ctrlYTimeout);
    clearTimeout(this.ctrlZTimeout);
  }

  onInsertComponentsButtonClick() {
    this.props.showBuilderPane(BUILDER_PANE_TYPE.ADD_COMPONENTS);
  }

  onColorsButtonClick() {
    this.props.showBuilderPane(BUILDER_PANE_TYPE.COLORS);
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
      const chartList = Object.values(this.props.charts);
      this.props.logEvent(LOG_ACTIONS_FORCE_REFRESH_DASHBOARD, {
        force: true,
        interval: 0,
        chartCount: chartList.length,
      });
      return this.props.fetchCharts(chartList, true);
    }
    return false;
  }

  startPeriodicRender(interval) {
    this.props.logEvent(LOG_ACTIONS_PERIODIC_RENDER_DASHBOARD, {
      force: true,
      interval,
    });
    return this.props.startPeriodicRender(interval);
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
      css,
      colorNamespace,
      colorScheme,
      filters,
      dashboardInfo,
      refreshFrequency,
    } = this.props;

    const scale = CategoricalColorNamespace.getScale(
      colorScheme,
      colorNamespace,
    );
    const labelColors = scale.getColorMap();
    const data = {
      positions,
      expanded_slices: expandedSlices,
      css,
      color_namespace: colorNamespace,
      color_scheme: colorScheme,
      label_colors: labelColors,
      dashboard_title: dashboardTitle,
      default_filters: safeStringify(filters),
      refresh_frequency: refreshFrequency,
    };

    // make sure positions data less than DB storage limitation:
    const positionJSONLength = safeStringify(positions).length;
    const limit =
      dashboardInfo.common.conf.SUPERSET_DASHBOARD_POSITION_DATA_LIMIT ||
      DASHBOARD_POSITION_DATA_LIMIT;
    if (positionJSONLength >= limit) {
      this.props.addDangerToast(
        t(
          'Your dashboard is too large. Please reduce the size before save it.',
        ),
      );
    } else {
      if (positionJSONLength >= limit * 0.9) {
        this.props.addWarningToast('Your dashboard is near the size limit.');
      }

      this.props.onSave(data, dashboardInfo.id, SAVE_TYPE_OVERWRITE);
    }
  }

  render() {
    const {
      dashboardTitle,
      layout,
      filters,
      expandedSlices,
      css,
      colorNamespace,
      colorScheme,
      onUndo,
      onRedo,
      undoLength,
      redoLength,
      onChange,
      onSave,
      updateCss,
      editMode,
      builderPaneType,
      dashboardInfo,
      hasUnsavedChanges,
      isLoading,
      refreshFrequency,
      setRefreshFrequency,
    } = this.props;

    const userCanEdit = dashboardInfo.dash_edit_perm;
    const userCanSaveAs = dashboardInfo.dash_save_perm;
    const popButton = hasUnsavedChanges;

    return (
      <div className="dashboard-header">
        <div className="dashboard-component-header header-large">
          <EditableTitle
            title={dashboardTitle}
            canEdit={userCanEdit && editMode}
            onSaveTitle={this.handleChangeText}
            showTooltip={false}
          />
          <span className="favstar">
            <FaveStar
              itemId={dashboardInfo.id}
              fetchFaveStar={this.props.fetchFaveStar}
              saveFaveStar={this.props.saveFaveStar}
              isStarred={this.props.isStarred}
            />
          </span>
        </div>

        <div className="button-container">
          {userCanSaveAs && (
            <div className="button-container">
              {editMode && (
                <Button
                  bsSize="small"
                  onClick={onUndo}
                  disabled={undoLength < 1}
                  bsStyle={this.state.emphasizeUndo ? 'primary' : undefined}
                >
                  <div title="Undo" className="undo-action fa fa-reply" />
                </Button>
              )}

              {editMode && (
                <Button
                  bsSize="small"
                  onClick={onRedo}
                  disabled={redoLength < 1}
                  bsStyle={this.state.emphasizeRedo ? 'primary' : undefined}
                >
                  <div title="Redo" className="redo-action fa fa-share" />
                </Button>
              )}

              {editMode && (
                <Button
                  active={builderPaneType === BUILDER_PANE_TYPE.ADD_COMPONENTS}
                  bsSize="small"
                  onClick={this.onInsertComponentsButtonClick}
                >
                  {t('Insert components')}
                </Button>
              )}

              {editMode && (
                <Button
                  active={builderPaneType === BUILDER_PANE_TYPE.COLORS}
                  bsSize="small"
                  onClick={this.onColorsButtonClick}
                >
                  {t('Colors')}
                </Button>
              )}

              {editMode && hasUnsavedChanges && (
                <Button
                  bsSize="small"
                  bsStyle={popButton ? 'primary' : undefined}
                  onClick={this.overwriteDashboard}
                >
                  {t('Save changes')}
                </Button>
              )}

              {editMode && !hasUnsavedChanges && (
                <Button
                  bsSize="small"
                  onClick={this.toggleEditMode}
                  bsStyle={undefined}
                  disabled={!userCanEdit}
                >
                  {t('Switch to view mode')}
                </Button>
              )}

              {editMode && (
                <UndoRedoKeylisteners
                  onUndo={this.handleCtrlZ}
                  onRedo={this.handleCtrlY}
                />
              )}
            </div>
          )}

          {!editMode && !hasUnsavedChanges && (
            <Button
              bsSize="small"
              onClick={this.toggleEditMode}
              bsStyle={popButton ? 'primary' : undefined}
              disabled={!userCanEdit}
            >
              {t('Edit dashboard')}
            </Button>
          )}

          <HeaderActionsDropdown
            addSuccessToast={this.props.addSuccessToast}
            addDangerToast={this.props.addDangerToast}
            dashboardId={dashboardInfo.id}
            dashboardTitle={dashboardTitle}
            layout={layout}
            filters={filters}
            expandedSlices={expandedSlices}
            css={css}
            colorNamespace={colorNamespace}
            colorScheme={colorScheme}
            onSave={onSave}
            onChange={onChange}
            forceRefreshAllCharts={this.forceRefresh}
            startPeriodicRender={this.startPeriodicRender}
            refreshFrequency={refreshFrequency}
            setRefreshFrequency={setRefreshFrequency}
            updateCss={updateCss}
            editMode={editMode}
            hasUnsavedChanges={hasUnsavedChanges}
            userCanEdit={userCanEdit}
            userCanSave={userCanSaveAs}
            isLoading={isLoading}
          />
        </div>
      </div>
    );
  }
}

Header.propTypes = propTypes;
Header.defaultProps = defaultProps;

export default Header;
