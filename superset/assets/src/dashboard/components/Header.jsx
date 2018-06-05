/* eslint-env browser */
import React from 'react';
import PropTypes from 'prop-types';
import { ButtonGroup, ButtonToolbar } from 'react-bootstrap';

import HeaderActionsDropdown from './HeaderActionsDropdown';
import EditableTitle from '../../components/EditableTitle';
import Button from '../../components/Button';
import FaveStar from '../../components/FaveStar';
import V2PreviewModal from '../deprecated/V2PreviewModal';

import { chartPropShape } from '../util/propShapes';
import { t } from '../../locales';
import { UNDO_LIMIT, SAVE_TYPE_OVERWRITE } from '../util/constants';

const propTypes = {
  addSuccessToast: PropTypes.func.isRequired,
  addDangerToast: PropTypes.func.isRequired,
  dashboardInfo: PropTypes.object.isRequired,
  dashboardTitle: PropTypes.string.isRequired,
  charts: PropTypes.objectOf(chartPropShape).isRequired,
  layout: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  expandedSlices: PropTypes.object.isRequired,
  css: PropTypes.string.isRequired,
  isStarred: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  fetchFaveStar: PropTypes.func.isRequired,
  fetchCharts: PropTypes.func.isRequired,
  saveFaveStar: PropTypes.func.isRequired,
  startPeriodicRender: PropTypes.func.isRequired,
  updateDashboardTitle: PropTypes.func.isRequired,
  editMode: PropTypes.bool.isRequired,
  isV2Preview: PropTypes.bool.isRequired,
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
      showV2PreviewModal: props.isV2Preview,
    };

    this.handleChangeText = this.handleChangeText.bind(this);
    this.toggleEditMode = this.toggleEditMode.bind(this);
    this.forceRefresh = this.forceRefresh.bind(this);
    this.overwriteDashboard = this.overwriteDashboard.bind(this);
    this.toggleShowV2PreviewModal = this.toggleShowV2PreviewModal.bind(this);
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

  forceRefresh() {
    return this.props.fetchCharts(Object.values(this.props.charts), true);
  }

  handleChangeText(nextText) {
    const { updateDashboardTitle, onChange } = this.props;
    if (nextText && this.props.dashboardTitle !== nextText) {
      updateDashboardTitle(nextText);
      onChange();
    }
  }

  toggleEditMode() {
    this.props.setEditMode(!this.props.editMode);
  }

  toggleShowV2PreviewModal() {
    this.setState({ showV2PreviewModal: !this.state.showV2PreviewModal });
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

    this.props.onSave(data, dashboardInfo.id, SAVE_TYPE_OVERWRITE);
  }

  render() {
    const {
      dashboardTitle,
      layout,
      filters,
      expandedSlices,
      css,
      isV2Preview,
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
    } = this.props;

    const userCanEdit = dashboardInfo.dash_edit_perm;
    const userCanSaveAs = dashboardInfo.dash_save_perm;

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
          {isV2Preview && (
            <div
              role="none"
              className="v2-preview-badge"
              onClick={this.toggleShowV2PreviewModal}
            >
              {t('v2 Preview')}
              <span className="fa fa-info-circle m-l-5" />
            </div>
          )}
          {isV2Preview &&
            this.state.showV2PreviewModal && (
              <V2PreviewModal onClose={this.toggleShowV2PreviewModal} />
            )}
        </div>

        <ButtonToolbar>
          {userCanSaveAs && (
            <ButtonGroup>
              {editMode && (
                <Button
                  bsSize="small"
                  onClick={onUndo}
                  disabled={undoLength < 1}
                >
                  <div title="Undo" className="undo-action fa fa-reply" />
                </Button>
              )}

              {editMode && (
                <Button
                  bsSize="small"
                  onClick={onRedo}
                  disabled={redoLength < 1}
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

              {hasUnsavedChanges && editMode ? (
                <Button
                  bsSize="small"
                  bsStyle={
                    hasUnsavedChanges || isV2Preview ? 'primary' : undefined
                  }
                  onClick={this.overwriteDashboard}
                >
                  {isV2Preview
                    ? t('Persist as v2 Dashboard')
                    : t('Save changes')}
                </Button>
              ) : (
                <Button
                  bsSize="small"
                  onClick={this.toggleEditMode}
                  bsStyle={
                    hasUnsavedChanges || isV2Preview ? 'primary' : undefined
                  }
                  disabled={!userCanEdit}
                >
                  {editMode
                    ? t('Switch to view mode')
                    : (isV2Preview &&
                        t('Edit & save to persist v2 dashboard')) ||
                      t('Edit dashboard')}
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
                isV2Preview={isV2Preview}
              />
            </ButtonGroup>
          )}
        </ButtonToolbar>
      </div>
    );
  }
}

Header.propTypes = propTypes;

export default Header;
