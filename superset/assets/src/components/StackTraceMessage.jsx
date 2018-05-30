/* eslint-disable react/no-danger */
import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Collapse } from 'react-bootstrap';

const propTypes = {
  message: PropTypes.string,
  queryResponse: PropTypes.object,
  showStackTrace: PropTypes.bool,
};
const defaultProps = {
  showStackTrace: false,
};

class StackTraceMessage extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      showStackTrace: props.showStackTrace,
    };
  }

  hasTrace() {
    return this.props.queryResponse && this.props.queryResponse.stacktrace;
  }

  render() {
    return (
      <div className={`stack-trace-container${this.hasTrace() ? ' has-trace' : ''}`}>
        <Alert
          bsStyle="warning"
          onClick={() => this.setState({ showStackTrace: !this.state.showStackTrace })}
        >
          {this.props.message}
        </Alert>
        {this.hasTrace() &&
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
