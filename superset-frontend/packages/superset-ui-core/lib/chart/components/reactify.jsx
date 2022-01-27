/*
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
export default function reactify(renderFn, callbacks) {
    class ReactifiedComponent extends React.Component {
        container;
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
            this.container = undefined;
            if (callbacks?.componentWillUnmount) {
                callbacks.componentWillUnmount.bind(this)();
            }
        }
        setContainerRef(ref) {
            this.container = ref;
        }
        execute() {
            if (this.container) {
                renderFn(this.container, this.props);
            }
        }
        render() {
            const { id, className } = this.props;
            return <div ref={this.setContainerRef} id={id} className={className}/>;
        }
    }
    const ReactifiedClass = ReactifiedComponent;
    if (renderFn.displayName) {
        ReactifiedClass.displayName = renderFn.displayName;
    }
    // eslint-disable-next-line react/forbid-foreign-prop-types
    if (renderFn.propTypes) {
        ReactifiedClass.propTypes = {
            ...ReactifiedClass.propTypes,
            ...renderFn.propTypes,
        };
    }
    if (renderFn.defaultProps) {
        ReactifiedClass.defaultProps = renderFn.defaultProps;
    }
    return ReactifiedComponent;
}
//# sourceMappingURL=reactify.jsx.map