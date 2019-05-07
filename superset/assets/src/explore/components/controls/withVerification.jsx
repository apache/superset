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

export default function withVerification(WrappedComponent, optionLabel, optionsName) {
  return class extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        validOptions: [],
        hasRunVerification: false,
      };
    }

    componentWillReceiveProps(nextProps) {
      const { hasRunVerification } = this.state;
      const endpoint = nextProps.getEndpoint(nextProps.controlValues);
      if (endpoint) {
        if (!isEqual(this.props.controlValues, nextProps.controlValues) || !hasRunVerification) {
          SupersetClient.get({
            endpoint,
          }).then(({ json }) => {
            if (Array.isArray(json)) {
              this.setState({ validOptions: json || [] });
            }
          }).catch(error => console.log(error));

          this.setState({ hasRunVerification: true });
        }
      }
    }

    render() {
      const { validOptions } = this.state;
      let options = this.props[optionsName];
      if (validOptions.length) {
        options = options.filter(o => (validOptions.indexOf(o[optionLabel]) >= 0));
      }

      const newProps = { ...this.props, [optionsName]: options };

      return (
        <WrappedComponent
          {...newProps}
        />
      );
    }
  };
}

