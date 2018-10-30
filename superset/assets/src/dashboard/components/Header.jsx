/* eslint-env browser */
import React from 'react';
import PropTypes from 'prop-types';
import { t } from '@superset-ui/translation';

import HeaderActionsDropdown from './HeaderActionsDropdown';
import EditableTitle from '../../components/EditableTitle';
import Button from '../../components/Button';
import FaveStar from '../../components/FaveStar';
import UndoRedoKeylisteners from './UndoRedoKeylisteners';

import { chartPropShape } from '../util/propShapes';
import {
  UNDO_LIMIT,
  SAVE_TYPE_OVERWRITE,
  DASHBOARD_POSITION_DATA_LIMIT,
} from '../util/constants';

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
  showBuilderPane: PropTypes.bool.isRequired,
  toggleBuilderPane: PropTypes.func.isRequired,
  updateCss: PropTypes.func.isRequired,
  hasUnsavedChanges: PropTypes.bool.isRequired,
  maxUndoHistoryExceeded: PropTypes.bool.isRequired,

  // redux
  onUndo: PropTypes.func.isRequired,
  onRedo: PropTypes.func.isRequired,
  undoLength: PropTypes.number.isRequired,
  redoLength: PropTypes.number.isRequired,
  setMaxUndoHistoryExceeded: PropTypes.func.isRequired,
  maxUndoHistoryToast: PropTypes.func.isRequired,
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
    this.toggleEditMode = this.toggleEditMode.bind(this);
    this.forceRefresh = this.forceRefresh.bind(this);
    this.overwriteDashboard = this.overwriteDashboard.bind(this);
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

  forceRefresh() {
    if (!this.props.isLoading) {
      return this.props.fetchCharts(Object.values(this.props.charts), true);
    }
    return false;
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

  toggleEditMode() {
    this.props.setEditMode(!this.props.editMode);
  }

  overwriteDashboard() {
    const {
      dashboardTitle,
      layout: positions,
      expandedSlices,
      css,
      filters,
      dashboardInfo,
    } = this.props;

    const data = {
      positions,
      expanded_slices: expandedSlices,
      css,
      dashboard_title: dashboardTitle,
      default_filters: JSON.stringify(filters),
    };

    // make sure positions data less than DB storage limitation:
    const positionJSONLength = JSON.stringify(positions).length;
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
      onUndo,
      onRedo,
      undoLength,
      redoLength,
      onChange,
      onSave,
      updateCss,
      editMode,
      showBuilderPane,
      dashboardInfo,
      hasUnsavedChanges,
      isLoading,
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
                <Button bsSize="small" onClick={this.props.toggleBuilderPane}>
                  {showBuilderPane
                    ? t('Hide components')
                    : t('Insert components')}
                </Button>
              )}

              {editMode &&
                hasUnsavedChanges && (
                  <Button
                    bsSize="small"
                    bsStyle={popButton ? 'primary' : undefined}
                    onClick={this.overwriteDashboard}
                  >
                    {t('Save changes')}
                  </Button>
                )}

              {editMode &&
                !hasUnsavedChanges && (
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

          {!editMode &&
            !hasUnsavedChanges && (
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
            onSave={onSave}
            onChange={onChange}
            forceRefreshAllCharts={this.forceRefresh}
            startPeriodicRender={this.props.startPeriodicRender}
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

export default Header;
