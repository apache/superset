import React from 'react';
import PropTypes from 'prop-types';

import Controls from './Controls';
import EditableTitle from '../../components/EditableTitle';
import Button from '../../components/Button';
import FaveStar from '../../components/FaveStar';

const propTypes = {
  dashboard: PropTypes.object.isRequired,
  userId: PropTypes.string.isRequired,
  isStarred: PropTypes.bool,
  addSlicesToDashboard: PropTypes.func,
  onSave: PropTypes.func,
  onChange: PropTypes.func,
  fetchFaveStar: PropTypes.func,
  readFilters: PropTypes.func,
  renderSlices: PropTypes.func,
  saveFaveStar: PropTypes.func,
  serialize: PropTypes.func,
  startPeriodicRender: PropTypes.func,
  updateDashboardTitle: PropTypes.func,
  editMode: PropTypes.bool.isRequired,
  setEditMode: PropTypes.func.isRequired,
};

class Header extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { hover: false };
    this.handleSaveTitle = this.handleSaveTitle.bind(this);
    this.setHover = this.setHover.bind(this);
    this.toggleEditMode = this.toggleEditMode.bind(this);
  }
  setHover(hover) {
    this.setState({ hover });
  }
  handleSaveTitle(title) {
    this.props.updateDashboardTitle(title);
  }
  toggleEditMode() {
    this.props.setEditMode(!this.props.editMode);
  }
  renderEditButton() {
    if (!this.state.hover) {
      return null;
    }
    const btnText = this.props.editMode ? 'Switch to View Mode' : 'Switch to Edit Mode';
    return <Button bsStyle="primary" onClick={this.toggleEditMode}>{btnText}</Button>;
  }
  render() {
    const dashboard = this.props.dashboard;
    return (
      <div
        className="title"
        onMouseEnter={() => { this.setHover(true); }}
        onMouseLeave={() => { this.setHover(false); }}
      >
        <div className="pull-left">
          <h1 className="outer-container pull-left">
            <EditableTitle
              title={dashboard.dashboard_title}
              canEdit={dashboard.dash_save_perm && this.props.editMode}
              onSaveTitle={this.handleSaveTitle}
              noPermitTooltip={'You don\'t have the rights to alter this dashboard.'}
            />
            <span className="favstar m-r-5">
              <FaveStar
                itemId={dashboard.id}
                fetchFaveStar={this.props.fetchFaveStar}
                saveFaveStar={this.props.saveFaveStar}
                isStarred={this.props.isStarred}
              />
            </span>
            {this.props.editMode &&
              <Button bsStyle="warning" className="m-r-5" style={{ cursor: 'default' }}>
                editing
              </Button>
            }
            {this.renderEditButton()}
          </h1>
        </div>
        <div className="pull-right" style={{ marginTop: '35px' }}>
          {this.props.editMode &&
          <Controls
            dashboard={dashboard}
            userId={this.props.userId}
            addSlicesToDashboard={this.props.addSlicesToDashboard}
            onSave={this.props.onSave}
            onChange={this.props.onChange}
            readFilters={this.props.readFilters}
            renderSlices={this.props.renderSlices}
            serialize={this.props.serialize}
            startPeriodicRender={this.props.startPeriodicRender}
          />
        }
        </div>
        <div className="clearfix" />
      </div>
    );
  }
}
Header.propTypes = propTypes;

export default Header;
