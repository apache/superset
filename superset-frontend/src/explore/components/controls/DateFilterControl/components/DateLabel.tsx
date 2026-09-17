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

import { forwardRef, MouseEvent, ReactNode, RefObject } from 'react';

import { css, styled, useTheme, t } from '@superset-ui/core';
import Icons from 'src/components/Icons';

export type DateLabelProps = {
  name?: string;
  label: ReactNode;
  isActive?: boolean;
  isPlaceholder?: boolean;
  onClick?: (event: MouseEvent) => void;
};

// This is the color that antd components (such as Select or Input) use on hover
// TODO: use theme.colors.primary.base here and in antd components
const ACTIVE_BORDER_COLOR = '#45BED6';

const LabelContainer = styled.div<{
  isActive?: boolean;
  isPlaceholder?: boolean;
}>`
  ${({ theme, isActive, isPlaceholder }) => css`
    width: 100%;
    height: ${theme.gridUnit * 8}px;

    display: flex;
    align-items: center;
    flex-wrap: nowrap;

    padding: 0 ${theme.gridUnit * 3}px;

    background-color: ${theme.colors.grayscale.light5};

    border: 1px solid
      ${isActive ? ACTIVE_BORDER_COLOR : theme.colors.grayscale.light2};
    border-radius: ${theme.borderRadius}px;

    cursor: pointer;

    transition: border-color 0.3s cubic-bezier(0.65, 0.05, 0.36, 1);
    :hover,
    :focus {
      border-color: ${ACTIVE_BORDER_COLOR};
    }

    .date-label-content {
      color: ${isPlaceholder
        ? theme.colors.grayscale.light1
        : theme.colors.grayscale.dark1};
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
      flex-shrink: 1;
      white-space: nowrap;
    }

    span[role='img'] {
      margin-left: auto;
      padding-left: ${theme.gridUnit}px;

      & > span[role='img'] {
        line-height: 0;
      }
    }
  `}
`;

export const DateLabel = forwardRef(
  (props: DateLabelProps, ref: RefObject<HTMLSpanElement>) => {
    const theme = useTheme();
    return (
      <LabelContainer {...props} tabIndex={0} role="button">
        <span
          id={`date-label-${props.name}`}
          className="date-label-content"
          ref={ref}
        >
          {typeof props.label === 'string' ? t(props.label) : props.label}
        </span>
        <Icons.CalendarOutlined
          iconSize="s"
          iconColor={theme.colors.grayscale.base}
        />
      </LabelContainer>
    );
  },
);
