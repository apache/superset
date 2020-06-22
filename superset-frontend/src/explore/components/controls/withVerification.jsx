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
import { SupersetClient } from '@superset-ui/connection';

import { isEqual } from 'lodash';

export default function withVerification(
  WrappedComponent,
  optionLabel,
  optionsName,
) {
  /*
   * This function will verify control options before passing them to the control by calling an
   * endpoint on mount and when the controlValues change. controlValues should be set in
   * mapStateToProps that can be added as a control override along with getEndpoint.
   */
  class withVerificationComponent extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        validOptions: null,
        hasRunVerification: false,
      };

      this.getValidOptions = this.getValidOptions.bind(this);
    }

    componentDidMount() {
      this.getValidOptions();
    }

    componentDidUpdate(prevProps) {
      const { hasRunVerification } = this.state;
      if (
        !isEqual(this.props.controlValues, prevProps.controlValues) ||
        !hasRunVerification
      ) {
        this.getValidOptions();
      }
    }

    getValidOptions() {
      const endpoint = this.props.getEndpoint(this.props.controlValues);
      if (endpoint) {
        SupersetClient.get({
          endpoint,
        })
          .then(({ json }) => {
            if (Array.isArray(json)) {
              this.setState({ validOptions: new Set(json) || new Set() });
            }
          })
          .catch(error => console.log(error));

        if (!this.state.hasRunVerification) {
          this.setState({ hasRunVerification: true });
        }
      }
    }

    render() {
      const { validOptions } = this.state;
      const options = this.props[optionsName];
      const verifiedOptions = validOptions
        ? options.filter(o => validOptions.has(o[optionLabel]))
        : options;

      const newProps = { ...this.props, [optionsName]: verifiedOptions };

      return <WrappedComponent {...newProps} />;
    }
  }
  withVerificationComponent.propTypes = WrappedComponent.propTypes;
  return withVerificationComponent;
}
