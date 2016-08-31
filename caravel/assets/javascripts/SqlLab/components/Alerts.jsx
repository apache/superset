import React from 'react';
import { Alert } from 'react-bootstrap';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';

class Alerts extends React.Component {
  removeAlert(alert) {
    this.props.actions.removeAlert(alert);
  }
  render() {
    const alerts = this.props.alerts.map((alert) =>
      <Alert
        bsStyle={alert.bsStyle}
        style={{ width: '500px', textAlign: 'midddle', margin: '10px auto' }}
      >
        {alert.msg}
        <i
          className="fa fa-close pull-right"
          onClick={this.removeAlert.bind(this, alert)}
          style={{ cursor: 'pointer' }}
        />
      </Alert>
    );
    return (
      <div>{alerts}</div>
    );
  }
}

Alerts.propTypes = {
  alerts: React.PropTypes.array,
  actions: React.PropTypes.object,
};

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}
export default connect(null, mapDispatchToProps)(Alerts);
