import React from 'react';
import PropTypes from 'prop-types';

import DashboardBuilder from './DashboardBuilder';
import StaticDashboard from './StaticDashboard';
import DashboardHeader from './DashboardHeader';

import '../../../../stylesheets/dashboard-v2.css';
import '../stylesheets/index.less';

const propTypes = {
  actions: PropTypes.shape({
    updateDashboardTitle: PropTypes.func.isRequired,
    setEditMode: PropTypes.func.isRequired,
  }),
  editMode: PropTypes.bool,
};

const defaultProps = {
  editMode: true,
};

class Dashboard extends React.Component {
  render() {
    const { editMode, actions } = this.props;
    const { setEditMode, updateDashboardTitle } = actions;
    return (
      <div className="dashboard-v2">
        <DashboardHeader
          editMode={true}
          setEditMode={setEditMode}
          updateDashboardTitle={updateDashboardTitle}
        />

        {true ?
          <DashboardBuilder /> : <StaticDashboard />}
      </div>
    );
  }
}

Dashboard.propTypes = propTypes;
Dashboard.defaultProps = defaultProps;

export default Dashboard;
