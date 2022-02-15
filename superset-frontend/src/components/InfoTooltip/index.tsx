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
import { styled } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';

export interface InfoTooltipProps {
  className?: string;
  tooltip: string;
  placement?:
    | 'bottom'
    | 'left'
    | 'right'
    | 'top'
    | 'topLeft'
    | 'topRight'
    | 'bottomLeft'
    | 'bottomRight'
    | 'leftTop'
    | 'leftBottom'
    | 'rightTop'
    | 'rightBottom'
    | undefined;
  trigger?: string | Array<string>;
  overlayStyle?: any;
  bgColor?: string;
  viewBox?: string;
}

const StyledTooltip = styled(Tooltip)`
  cursor: pointer;
  path:first-of-type {
    fill: #999999;
  }
`;

const StyledTooltipTitle = styled.span`
  display: -webkit-box;
  -webkit-line-clamp: 20;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const defaultOverlayStyle = {
  fontSize: '12px',
  lineHeight: '16px',
};

const defaultColor = 'rgba(0,0,0,0.9)';

export default function InfoTooltip({
  tooltip,
  placement = 'right',
  trigger = 'hover',
  overlayStyle = defaultOverlayStyle,
  bgColor = defaultColor,
  viewBox = '0 -2 24 24',
}: InfoTooltipProps) {
  return (
    <StyledTooltip
      title={<StyledTooltipTitle>{tooltip}</StyledTooltipTitle>}
      placement={placement}
      trigger={trigger}
      overlayStyle={overlayStyle}
      color={bgColor}
    >
      <Icons.InfoSolidSmall className="info-solid-small" viewBox={viewBox} />
    </StyledTooltip>
  );
}
