/* eslint-disable react/no-danger */
import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Collapse } from 'react-bootstrap';

const propTypes = {
  message: PropTypes.string,
  queryResponse: PropTypes.object,
  showStackTrace: PropTypes.bool,
  resolutionLink: PropTypes.string,
};
const defaultProps = {
  showStackTrace: false,
  resolutionLink: '',
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

  hasLink() {
    return this.props.queryResponse && this.props.queryResponse.link;
  }

  render() {
    return (
      <div className={`stack-trace-container${this.hasTrace() ? ' has-trace' : ''}`}>
        <Alert
          bsStyle="warning"
          onClick={() => this.setState({ showStackTrace: !this.state.showStackTrace })}
        >
          {this.props.message}
          {this.hasLink() &&
          <a href={this.props.queryResponse.link}> (Request Access) </a>
       }
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
