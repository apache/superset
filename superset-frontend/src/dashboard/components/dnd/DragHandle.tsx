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
import React, { LegacyRef } from 'react';
import { css, styled } from '@superset-ui/core';
import Icons from 'src/components/Icons';

interface DragHandleProps {
  position: 'left' | 'top';
  innerRef?: LegacyRef<HTMLDivElement> | undefined;
}

const DragHandleContainer = styled.div<{ position: 'left' | 'top' }>`
  ${({ theme, position }) => css`
    height: ${theme.gridUnit * 5}px;
    overflow: hidden;
    cursor: move;
    ${position === 'top' &&
    css`
      transform: rotate(90deg);
    `}
    & path {
      fill: ${theme.colors.grayscale.base};
    }
  `}
`;
export default function DragHandle({
  position = 'left',
  innerRef = null,
}: DragHandleProps) {
  return (
    <DragHandleContainer ref={innerRef} position={position}>
      <Icons.Drag />
    </DragHandleContainer>
  );
}
