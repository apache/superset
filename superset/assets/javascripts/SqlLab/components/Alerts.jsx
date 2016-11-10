import React from 'react';
import { Alert } from 'react-bootstrap';

class Alerts extends React.PureComponent {
  removeAlert(alert) {
    this.props.actions.removeAlert(alert);
  }
  render() {
    const alerts = this.props.alerts.map((alert) =>
      <Alert
        key={alert.id}
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

export default Alerts;
