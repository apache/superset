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

import { styled, safeHtmlSpan } from '@superset-ui/core';
import { ReactNode } from 'react';

export type TooltipProps = {
  tooltip:
    | {
        x: number;
        y: number;
        content: ReactNode;
      }
    | null
    | undefined;
  variant?: 'default' | 'custom';
};

const StyledDiv = styled.div<{
  top: number;
  left: number;
  variant: 'default' | 'custom';
}>`
  ${({ theme, top, left, variant }) => `
    position: absolute;
    top: ${top}px;
    left: ${left}px;
    zIndex: 9;
    pointerEvents: none;
    ${
      variant === 'default'
        ? `
      padding: ${theme.sizeUnit * 2}px;
      margin: ${theme.sizeUnit * 2}px;
      background: ${theme.colors.grayscale.dark2};
      color: ${theme.colors.grayscale.light5};
      maxWidth: 300px;
      fontSize: ${theme.fontSizeSM}px;
    `
        : ''
    }
  `}
`;

export default function Tooltip(props: TooltipProps) {
  const { tooltip, variant = 'default' } = props;
  if (typeof tooltip === 'undefined' || tooltip === null) {
    return null;
  }

  const { x, y, content } = tooltip;
  const safeContent =
    typeof content === 'string' ? safeHtmlSpan(content) : content;

  return (
    <StyledDiv top={y} left={x} variant={variant}>
      {safeContent}
    </StyledDiv>
  );
}
