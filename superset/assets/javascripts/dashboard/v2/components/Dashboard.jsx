import React from 'react';
import PropTypes from 'prop-types';

import DashboardBuilder from '../containers/DashboardBuilder';

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
    // @TODO delete this component?
    return <DashboardBuilder />;
  }
}

Dashboard.propTypes = propTypes;
Dashboard.defaultProps = defaultProps;

export default Dashboard;
