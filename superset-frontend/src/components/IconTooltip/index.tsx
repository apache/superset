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
import { ReactNode } from 'react';
import { Tooltip } from 'src/components/Tooltip';
import { styled } from '@superset-ui/core';

export interface Props {
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
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
    | 'rightBottom';
  style?: object;
  tooltip?: string | null;
}

const StyledSpan = styled.span`
  color: ${({ theme }) => theme.colors.primary.dark1};
  &: hover {
    color: ${({ theme }) => theme.colors.primary.dark2};
  }
`;

const IconTooltip = ({
  children = null,
  className = '',
  onClick = () => undefined,
  placement = 'top',
  style = {},
  tooltip = null,
}: Props) => {
  const iconTooltip = (
    <StyledSpan
      onClick={onClick}
      style={style}
      className={`IconTooltip ${className}`}
    >
      {children}
    </StyledSpan>
  );
  if (tooltip) {
    return (
      <Tooltip
        id="tooltip"
        title={tooltip}
        placement={placement}
        mouseEnterDelay={0.3}
        mouseLeaveDelay={0.15}
      >
        {iconTooltip}
      </Tooltip>
    );
  }
  return iconTooltip;
};

export { IconTooltip };
