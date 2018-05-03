import React from 'react';
import PropTypes from 'prop-types';
import { ButtonGroup, ButtonToolbar } from 'react-bootstrap';

import Controls from './Controls';
import EditableTitle from '../../components/EditableTitle';
import Button from '../../components/Button';
import FaveStar from '../../components/FaveStar';
import SaveModal from './SaveModal';
import { chartPropShape } from '../util/propShapes';
import { t } from '../../locales';
import { UNDO_LIMIT } from '../util/constants';

const propTypes = {
  dashboardInfo: PropTypes.object.isRequired,
  dashboardTitle: PropTypes.string.isRequired,
  charts: PropTypes.objectOf(chartPropShape).isRequired,
  layout: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  expandedSlices: PropTypes.object.isRequired,
  isStarred: PropTypes.bool.isRequired,
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
  constructor(props) {
    super(props);
    this.state = {
      didNotifyMaxUndoHistoryToast: false,
    };

    this.handleChangeText = this.handleChangeText.bind(this);
    this.toggleEditMode = this.toggleEditMode.bind(this);
    this.forceRefresh = this.forceRefresh.bind(this);
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

  render() {
    const {
      dashboardTitle,
      layout,
      filters,
      expandedSlices,
      onUndo,
      onRedo,
      undoLength,
      redoLength,
      onChange,
      onSave,
      editMode,
      showBuilderPane,
      dashboardInfo,
      hasUnsavedChanges,
    } = this.props;

    const userCanEdit = dashboardInfo.dash_save_perm;

    return (
      <div className="dashboard-header">
        <div className="dashboard-component-header header-large">
          <EditableTitle
            title={dashboardTitle}
            canEdit={this.props.dashboardInfo.dash_save_perm && editMode}
            onSaveTitle={this.handleChangeText}
            showTooltip={editMode}
          />
          <span className="favstar m-l-5">
            <FaveStar
              itemId={this.props.dashboardInfo.id}
              fetchFaveStar={this.props.fetchFaveStar}
              saveFaveStar={this.props.saveFaveStar}
              isStarred={this.props.isStarred}
            />
          </span>
        </div>
        <ButtonToolbar>
          {userCanEdit && (
            <ButtonGroup>
              {editMode && (
                <Button
                  bsSize="small"
                  onClick={onUndo}
                  disabled={undoLength < 1}
                >
                  <div title="Undo" className="undo-action fa fa-reply m-r-5" />
                  {undoLength} of {UNDO_LIMIT}
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
                    ? t('Hide builder pane')
                    : t('Insert components')}
                </Button>
              )}

              {!hasUnsavedChanges ? (
                <Button
                  bsSize="small"
                  onClick={this.toggleEditMode}
                  bsStyle={editMode ? undefined : 'primary'}
                >
                  {editMode ? t('Switch to View Mode') : t('Edit Dashboard')}
                </Button>
              ) : (
                <SaveModal
                  dashboardId={this.props.dashboardInfo.id}
                  dashboardTitle={dashboardTitle}
                  layout={layout}
                  filters={filters}
                  expandedSlices={expandedSlices}
                  onSave={onSave}
                  // @TODO need to figure out css
                  css=""
                  triggerNode={
                    <Button bsStyle="primary" bsSize="small">
                      {t('Save changes')}
                    </Button>
                  }
                />
              )}
            </ButtonGroup>
          )}

          <Controls
            dashboardInfo={this.props.dashboardInfo}
            dashboardTitle={dashboardTitle}
            layout={layout}
            filters={filters}
            expandedSlices={expandedSlices}
            onSave={onSave}
            onChange={onChange}
            forceRefreshAllCharts={this.forceRefresh}
            startPeriodicRender={this.props.startPeriodicRender}
            editMode={editMode}
          />
        </ButtonToolbar>
      </div>
    );
  }
}

Header.propTypes = propTypes;

export default Header;
