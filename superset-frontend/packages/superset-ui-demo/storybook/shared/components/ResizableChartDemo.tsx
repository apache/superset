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

import React, { useState, ReactNode } from 'react';
import { styled } from '@superset-ui/core';
import { DecoratorFunction } from '@storybook/addons';
import ResizablePanel, { Size } from './ResizablePanel';

export const SupersetBody = styled.div`
  background: ${({ theme }) => theme.colors.grayscale.light4};
  padding: 16px;
  min-height: 100%;

  .panel {
    margin-bottom: 0;
  }
`;

export default function ResizableChartDemo({
  children,
  panelPadding = 30,
  initialSize = { width: 500, height: 300 },
}: {
  children: (innerSize: Size) => ReactNode;
  panelPadding?: number;
  initialSize?: Size;
}) {
  // size are all inner size
  const [size, setSize] = useState(initialSize);
  return (
    <SupersetBody>
      <ResizablePanel
        initialSize={initialSize}
        onResize={(e, data) => setSize(data.size)}
      >
        {children({
          width: size.width - panelPadding,
          height: size.height - panelPadding,
        })}
      </ResizablePanel>
    </SupersetBody>
  );
}

export const withResizableChartDemo: DecoratorFunction<ReactNode> = (
  storyFn,
  context,
) => {
  const {
    parameters: { initialSize, panelPadding },
  } = context;
  return (
    <ResizableChartDemo
      initialSize={initialSize as Size | undefined}
      panelPadding={panelPadding}
    >
      {innerSize => storyFn({ ...context, ...innerSize })}
    </ResizableChartDemo>
  );
};
