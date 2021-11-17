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

// TODO: Note that id and className can collide between Props and ReactifyProps
// leading to (likely) unexpected behaviors. We should either require Props to not
// contain an id/className, or not combine them (via intersection), instead preferring
// wrapping (composition). As an example:
// interface MyProps {
//   id: number;
// }
// function myRender(container: HTMLDivElement, props: Readonly<MyProps>): void {
//   props.id // unusable: id is string & number
// }
// new (reactify(myRender))({ id: 5 }); // error: id has to be string & number

export type ReactifyProps = {
  id?: string;
  className?: string;
};

// TODO: add more React lifecycle callbacks as needed
export type LifeCycleCallbacks = {
  componentWillUnmount?: () => void;
};

export interface RenderFuncType<Props> {
  (container: HTMLDivElement, props: Readonly<Props & ReactifyProps>): void;
  displayName?: string;
  defaultProps?: Partial<Props & ReactifyProps>;
  propTypes?: React.WeakValidationMap<Props & ReactifyProps>;
}

export default function reactify<Props extends object>(
  renderFn: RenderFuncType<Props>,
  callbacks?: LifeCycleCallbacks,
): React.ComponentClass<Props & ReactifyProps> {
  class ReactifiedComponent extends React.Component<Props & ReactifyProps> {
    container?: HTMLDivElement;

    constructor(props: Props & ReactifyProps) {
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

    setContainerRef(ref: HTMLDivElement) {
      this.container = ref;
    }

    execute() {
      if (this.container) {
        renderFn(this.container, this.props);
      }
    }

    render() {
      const { id, className } = this.props;

      return <div ref={this.setContainerRef} id={id} className={className} />;
    }
  }

  const ReactifiedClass: React.ComponentClass<Props & ReactifyProps> =
    ReactifiedComponent;

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
