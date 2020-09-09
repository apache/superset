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
import { t } from '@superset-ui/core';
import ErrorMessageWithStackTrace from './ErrorMessage/ErrorMessageWithStackTrace';

const propTypes = {
  children: PropTypes.node.isRequired,
  onError: PropTypes.func,
  showMessage: PropTypes.bool,
};
const defaultProps = {
  onError: () => {},
  showMessage: true,
};

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  componentDidCatch(error, info) {
    this.props.onError(error, info);
    this.setState({ error, info });
  }

  render() {
    const { error, info } = this.state;
    if (error) {
      const firstLine = error.toString();
      const message = (
        <span>
          <strong>{t('Unexpected error')}</strong>
          {firstLine ? `: ${firstLine}` : ''}
        </span>
      );
      if (this.props.showMessage) {
        return (
          <ErrorMessageWithStackTrace
            message={message}
            stackTrace={info ? info.componentStack : null}
          />
        );
      }
      return null;
    }
    return this.props.children;
  }
}
ErrorBoundary.propTypes = propTypes;
ErrorBoundary.defaultProps = defaultProps;
