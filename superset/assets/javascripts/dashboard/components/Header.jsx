import React from 'react';
import PropTypes from 'prop-types';

import Controls from './Controls';
import EditableTitle from '../../components/EditableTitle';
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
};

class Header extends React.PureComponent {
  constructor(props) {
    super(props);

    this.handleSaveTitle = this.handleSaveTitle.bind(this);
  }
  handleSaveTitle(title) {
    this.props.updateDashboardTitle(title);
  }
  render() {
    const dashboard = this.props.dashboard;
    return (
      <div className="title">
        <div className="pull-left">
          <h1 className="outer-container">
            <EditableTitle
              title={dashboard.dashboard_title}
              canEdit={dashboard.dash_save_perm}
              onSaveTitle={this.handleSaveTitle}
              noPermitTooltip={'You don\'t have the rights to alter this dashboard.'}
            />
            <span className="favstar">
              <FaveStar
                itemId={dashboard.id}
                fetchFaveStar={this.props.fetchFaveStar}
                saveFaveStar={this.props.saveFaveStar}
                isStarred={this.props.isStarred}
              />
            </span>
          </h1>
        </div>
        <div className="pull-right" style={{ marginTop: '35px' }}>
          {!this.props.dashboard.standalone_mode &&
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
