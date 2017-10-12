/* eslint-disable react/no-danger */
import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Collapse } from 'react-bootstrap';

const propTypes = {
  message: PropTypes.string,
  queryResponse: PropTypes.object,
  showStackTrace: PropTypes.bool,
  removeAlert: PropTypes.func,
};
const defaultProps = {
  showStackTrace: false,
};

class StackTraceMessage extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      hidden: false,
      showStackTrace: props.showStackTrace,
    };
  }

  removeAlert() {
    if (this.props.removeAlert) {
      this.props.removeAlert();
    }

    this.setState({
      hidden: true,
      showStackTrace: false,
    });
  }

  render() {
    const msg = (
      <div>
        <i
          className="fa fa-close pull-right"
          onClick={this.removeAlert.bind(this)}
          style={{ cursor: 'pointer' }}
        />
        <p
          dangerouslySetInnerHTML={{ __html: this.props.message }}
        />
      </div>);

    return (
      <div style={{ display: this.state.hidden ? 'none' : 'block' }}>
        <Alert
          bsStyle="warning"
          onClick={() => this.setState({ showStackTrace: !this.state.showStackTrace })}
        >
          {msg}
        </Alert>
        {this.props.queryResponse && this.props.queryResponse.stacktrace &&
        <Collapse in={this.state.showStackTrace}>
          <pre>
            {this.props.queryResponse.stacktrace}
          </pre>
        </Collapse>
        }
      </div>
    );
  }
}

StackTraceMessage.propTypes = propTypes;
StackTraceMessage.defaultProps = defaultProps;

export default StackTraceMessage;
