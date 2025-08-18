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
import { Tag } from '@superset-ui/core/components/Tag';
import { css } from '@emotion/react';
import { useTheme, getColorVariants } from '@superset-ui/core';
import { DatasetTypeLabel } from './reusable/DatasetTypeLabel';
import { PublishedLabel } from './reusable/PublishedLabel';
import type { LabelProps } from './types';

export function Label(props: LabelProps) {
  const theme = useTheme();
  // Use Ant Design's motion duration instead of deprecated transitionTiming
  const {
    type = 'default',
    monospace = false,
    style,
    onClick,
    children,
    icon,
    id,
    ...rest
  } = props;

  const baseColor = getColorVariants(theme, type);
  const color = baseColor.active;
  const borderColor = baseColor.border;
  const backgroundColor = baseColor.bg;

  const backgroundColorHover = onClick ? baseColor.bgHover : backgroundColor;
  const borderColorHover = onClick ? baseColor.borderHover : borderColor;

  const labelStyles = css`
    transition: background-color ${theme.motionDurationMid};
    white-space: nowrap;
    cursor: ${onClick ? 'pointer' : 'default'};
    overflow: hidden;
    text-overflow: ellipsis;
    background-color: ${backgroundColor};
    border-radius: 8px;
    border-color: ${borderColor};
    padding: 0.35em 0.8em;
    line-height: 1;
    color: ${color};
    display: inline-flex;
    vertical-align: middle;
    align-items: center;
    max-width: 100%;
    &:hover {
      background-color: ${backgroundColorHover};
      border-color: ${borderColorHover};
      opacity: 1;
    }
    ${monospace ? `font-family: ${theme.fontFamilyCode};` : ''}
  `;

  return (
    <Tag
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={style}
      icon={icon}
      css={labelStyles}
      {...rest}
    >
      {children}
    </Tag>
  );
}
export { DatasetTypeLabel, PublishedLabel };
export type { LabelType } from './types';
