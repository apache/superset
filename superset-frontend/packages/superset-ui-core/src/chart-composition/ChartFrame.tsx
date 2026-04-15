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

import { PureComponent, ReactNode } from 'react';

import { isDefined } from '../utils';

function checkNumber(input: unknown): input is number {
  return isDefined(input) && typeof input === 'number';
}

type Props = {
  contentWidth?: number;
  contentHeight?: number;
  height: number;
  renderContent: ({
    height,
    width,
  }: {
    height: number;
    width: number;
  }) => ReactNode;
  width: number;
};

export default class ChartFrame extends PureComponent<Props, {}> {
  static defaultProps = {
    renderContent() {},
  };

  render() {
    const { contentWidth, contentHeight, width, height, renderContent } =
      this.props;

    const overflowX = checkNumber(contentWidth) && contentWidth > width;
    const overflowY = checkNumber(contentHeight) && contentHeight > height;

    if (overflowX || overflowY) {
      return (
        <div
          style={{
            height,
            overflowX: overflowX ? 'auto' : 'hidden',
            overflowY: overflowY ? 'auto' : 'hidden',
            width,
          }}
        >
          {renderContent({
            height: Math.max(contentHeight ?? 0, height),
            width: Math.max(contentWidth ?? 0, width),
          })}
        </div>
      );
    }

    return renderContent({ height, width });
  }
}
