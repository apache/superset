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
import React, { RefObject } from 'react';
import { styled } from '@superset-ui/core';
import cx from 'classnames';

interface HoverMenuProps {
  position: 'left' | 'top';
  innerRef: RefObject<HTMLDivElement>;
  children: React.ReactNode;
}

const HoverStyleOverrides = styled.div`
  .hover-menu {
    opacity: 0;
    position: absolute;
    z-index: @z-index-above-dashboard-charts;
    font-size: @font-size-m;
  }

  .hover-menu--left {
    width: 24px;
    top: 50%;
    transform: translate(0, -50%);
    left: -28px;
    padding: 8px 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .hover-menu--left > :nth-child(n):not(:only-child):not(:last-child) {
    margin-bottom: 12px;
  }

  .hover-menu--top {
    height: 24px;
    top: -24px;
    left: 50%;
    transform: translate(-50%);
    padding: 0 8px;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
  }
`;

export default class HoverMenu extends React.PureComponent<HoverMenuProps> {
  static defaultProps = {
    position: 'left',
    innerRef: null,
    children: null,
  };

  render() {
    const { innerRef, position, children } = this.props;
    return (
      <HoverStyleOverrides className="hover-menu-container">
        <div
          ref={innerRef}
          className={cx(
            'hover-menu',
            position === 'left' && 'hover-menu--left',
            position === 'top' && 'hover-menu--top',
          )}
        >
          {children}
        </div>
      </HoverStyleOverrides>
    );
  }
}
