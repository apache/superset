import React from 'react';
import PropTypes from 'prop-types';

import Controls from './Controls';
import EditableTitle from '../../components/EditableTitle';
import Button from '../../components/Button';
import FaveStar from '../../components/FaveStar';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';
import { t } from '../../locales';

const propTypes = {
  dashboardInfo: PropTypes.object.isRequired,
  dashboardTitle: PropTypes.string.isRequired,
  layout: PropTypes.object.isRequired,
  filters: PropTypes.object.isRequired,
  userId: PropTypes.string.isRequired,
  isStarred: PropTypes.bool,
  onSave: PropTypes.func,
  onChange: PropTypes.func,
  fetchFaveStar: PropTypes.func,
  renderSlices: PropTypes.func,
  saveFaveStar: PropTypes.func,
  startPeriodicRender: PropTypes.func,
  updateDashboardTitle: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
  setEditMode: PropTypes.func.isRequired,
  showBuilderPane: PropTypes.bool.isRequired,
  toggleBuilderPane: PropTypes.func.isRequired,
  unsavedChanges: PropTypes.bool.isRequired,
};

class Header extends React.PureComponent {
  constructor(props) {
    super(props);
    this.handleSaveTitle = this.handleSaveTitle.bind(this);
    this.toggleEditMode = this.toggleEditMode.bind(this);
  }
  handleSaveTitle(title) {
    this.props.updateDashboardTitle(title);
  }
  toggleEditMode() {
    this.props.setEditMode(!this.props.editMode);
  }
  renderUnsaved() {
    if (!this.props.unsavedChanges) {
      return null;
    }
    return (
      <InfoTooltipWithTrigger
        label="unsaved"
        tooltip={t('Unsaved changes')}
        icon="exclamation-triangle"
        className="text-danger m-r-5"
        placement="top"
      />
    );
  }
  renderInsertButton() {
    if (!this.props.editMode) {
      return null;
    }
    const btnText = this.props.showBuilderPane ? t('Hide builder pane') : t('Insert components');
    return (<Button
        bsStyle="default"
        className="m-r-5"
        style={{ width: '150px' }}
        onClick={this.props.toggleBuilderPane}
      >
        {btnText}
      </Button>);
  }
  renderEditButton() {
    if (!this.props.dashboardInfo.dash_save_perm) {
      return null;
    }
    const btnText = this.props.editMode ? t('Switch to View Mode') : t('Edit Dashboard');
    return (<Button
        bsStyle="default"
        className="m-r-5"
        style={{ width: '150px' }}
        onClick={this.toggleEditMode}
      >
        {btnText}
      </Button>);
  }
  render() {
    const { dashboardTitle, layout, filters, editMode } = this.props;
    return (
      <div className="title">
        <div className="pull-left">
          <h1 className="outer-container pull-left">
            <EditableTitle
              title={dashboardTitle}
              canEdit={this.props.dashboardInfo.dash_save_perm && editMode}
              onSaveTitle={this.handleSaveTitle}
              showTooltip={editMode}
            />
            <span className="favstar m-r-5">
              <FaveStar
                itemId={this.props.dashboardInfo.id}
                fetchFaveStar={this.props.fetchFaveStar}
                saveFaveStar={this.props.saveFaveStar}
                isStarred={this.props.isStarred}
              />
            </span>
            {this.renderUnsaved()}
          </h1>
        </div>
        <div className="pull-right" style={{ marginTop: '35px' }}>
          {this.renderInsertButton()}
          {this.renderEditButton()}
          <Controls
            dashboardInfo={this.props.dashboardInfo}
            dashboardTitle={dashboardTitle}
            layout={layout}
            filters={filters}
            onSave={this.props.onSave}
            onChange={this.props.onChange}
            renderSlices={this.props.renderSlices}
            startPeriodicRender={this.props.startPeriodicRender}
            editMode={editMode}
          />
        </div>
        <div className="clearfix" />
      </div>
    );
  }
}
Header.propTypes = propTypes;

export default Header;
