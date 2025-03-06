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

import { Component, ReactNode } from 'react';

export type Props = {
  children: ReactNode;
  expandableWhat?: string;
};

type State = {
  open: boolean;
};

export default class Expandable extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { open: false };
    this.handleToggle = this.handleToggle.bind(this);
  }

  handleToggle() {
    this.setState(({ open }) => ({ open: !open }));
  }

  render() {
    const { open } = this.state;
    const { children, expandableWhat } = this.props;

    return (
      <div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={this.handleToggle}
        >
          {`${open ? 'Hide' : 'Show'} ${expandableWhat}`}
        </button>
        <br />
        <br />
        {open ? children : null}
      </div>
    );
  }
}
