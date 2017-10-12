import React from 'react';
import PropTypes from 'prop-types';
import { Alert } from 'react-bootstrap';

const propTypes = {
  alertContent: PropTypes.node.isRequired,
};

const DashboardAlert = ({ alertContent }) => (
  <div id="alert-container">
    <div className="container-fluid">
      <Alert bsStyle="warning">
        {alertContent}
      </Alert>
    </div>
  </div>
);

DashboardAlert.propTypes = propTypes;

export default DashboardAlert;
