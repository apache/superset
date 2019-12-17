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
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as Actions from './actions/statusMessages';

const propTypes = {
  statusMessages: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
};

export class StatusMessages extends React.PureComponent {
  constructor(props) {
    super(props);

    this.handleButtonClick = this.handleButtonClick.bind(this);
    this.renderErrorContainer = this.renderErrorContainer.bind(this);
    this.renderInfoContainer = this.renderInfoContainer.bind(this);
    this.renderWarningContainer = this.renderWarningContainer.bind(this);
  }

  handleButtonClick(status) {
    this.props.actions.removeStatusMessage(status);
  }

  renderErrorContainer(status) {
    return (
      <div key={status.id} className="alert alert-danger">
        {status.message}
        <button
          key={status.id}
          className="close"
          onClick={() => this.handleButtonClick(status)}
        >
          ×
        </button>
      </div>
    );
  }

  renderInfoContainer(status) {
    return (
      <div key={status.id} className="alert alert-info">
        {status.message}
        <button
          key={status.id}
          className="close"
          onClick={() => this.handleButtonClick(status)}
        >
          ×
        </button>
      </div>
    );
  }

  renderWarningContainer(status) {
    return (
      <div key={status.id} className="alert alert-warning">
        {status.message}
        <button
          key={status.id}
          className="close"
          onClick={() => this.handleButtonClick(status)}
        >
          ×
        </button>
      </div>
    );
  }

  render() {
    const { statusMessages } = this.props;
    let elements = <></>;
    if (statusMessages && statusMessages.statusMessages) {
      elements = statusMessages.statusMessages.map(status => {
        switch (status.statusType) {
          case Actions.STATUS_TYPE.INFO:
            return this.renderInfoContainer(status);
          case Actions.STATUS_TYPE.WARNING:
            return this.renderWarningContainer(status);
          case Actions.STATUS_TYPE.ERROR:
            return this.renderErrorContainer(status);
          default:
            return <></>;
        }
      });
    }
    return <div className="alert-container">{elements}</div>;
  }
}

StatusMessages.propTypes = propTypes;

function mapStateToProps({ statusMessages }) {
  return { statusMessages };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(StatusMessages);
