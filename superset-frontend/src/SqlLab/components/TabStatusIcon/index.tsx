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
import { css, QueryState, styled } from '@superset-ui/core';
import Icons, { IconType } from 'src/components/Icons';

const IconContainer = styled.span`
  position: absolute;
  top: -6px;
  left: 1px;
`;

const Circle = styled.div`
  ${({ theme }) => css`
    border-radius: 50%;
    width: ${theme.gridUnit * 3}px;
    height: ${theme.gridUnit * 3}px;

    display: inline-block;
    background-color: ${theme.colors.grayscale.light2};
    text-align: center;
    vertical-align: middle;
    font-size: ${theme.typography.sizes.m}px;
    font-weight: ${theme.typography.weights.bold};
    color: ${theme.colors.grayscale.light5};
    position: relative;

    &.running {
      background-color: ${theme.colors.info.base};
    }

    &.success {
      background-color: ${theme.colors.success.base};
    }

    &.failed {
      background-color: ${theme.colors.error.base};
    }
  `}
`;

interface TabStatusIconProps {
  tabState: QueryState;
}

const STATE_ICONS: Record<string, React.FC<IconType>> = {
  success: Icons.Check,
  failed: Icons.CancelX,
};

export default function TabStatusIcon({ tabState }: TabStatusIconProps) {
  const StatusIcon = STATE_ICONS[tabState];
  return (
    <Circle className={`circle ${tabState}`}>
      {StatusIcon && (
        <IconContainer>
          <StatusIcon iconSize="xs" />
        </IconContainer>
      )}
    </Circle>
  );
}
