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

export default function reactify(renderFn) {
  class ReactifiedComponent extends React.Component {
    constructor(props) {
      super(props);
      this.setContainerRef = this.setContainerRef.bind(this);
    }

    componentDidMount() {
      this.execute();
    }

    componentDidUpdate() {
      this.execute();
    }

    componentWillUnmount() {
      this.container = null;
    }

    setContainerRef(c) {
      this.container = c;
    }

    execute() {
      if (this.container) {
        renderFn(this.container, this.props);
      }
    }

    render() {
      const { id, className } = this.props;
      return (
        <div
          id={id}
          className={className}
          ref={this.setContainerRef}
        />
      );
    }
  }

  if (renderFn.displayName) {
    ReactifiedComponent.displayName = renderFn.displayName;
  }
  if (renderFn.propTypes) {
    ReactifiedComponent.propTypes = renderFn.propTypes;
  }
  if (renderFn.defaultProps) {
    ReactifiedComponent.defaultProps = renderFn.defaultProps;
  }
  return ReactifiedComponent;
}
