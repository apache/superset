/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint-disable react/no-danger */
import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Collapse } from 'react-bootstrap';

const propTypes = {
  message: PropTypes.node.isRequired,
  link: PropTypes.string,
  stackTrace: PropTypes.string,
  showStackTrace: PropTypes.bool,
};
const defaultProps = {
  showStackTrace: false,
  link: null,
  stackTrace: null,
};

class StackTraceMessage extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      showStackTrace: props.showStackTrace,
    };
  }

  render() {
    return (
      <div
        className={`stack-trace-container${
          this.props.stackTrace ? ' has-trace' : ''
        }`}
      >
        <Alert
          bsStyle="warning"
          onClick={() =>
            this.setState({ showStackTrace: !this.state.showStackTrace })
          }
        >
          {this.props.message}
          {this.props.link && (
            <a href={this.props.link} target="_blank" rel="noopener noreferrer">
              (Request Access)
            </a>
          )}
        </Alert>
        {this.props.stackTrace && (
          <Collapse in={this.state.showStackTrace}>
            <pre>{this.props.stackTrace}</pre>
          </Collapse>
        )}
      </div>
    );
  }
}

StackTraceMessage.propTypes = propTypes;
StackTraceMessage.defaultProps = defaultProps;

export default StackTraceMessage;
