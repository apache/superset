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
import {
  CSSProperties,
  HTMLAttributes,
  MouseEventHandler,
  ReactNode,
} from 'react';

import { Tag } from 'src/components';
import { useTheme } from '@superset-ui/core';
import DatasetTypeLabel from 'src/components/Label/reusable/DatasetTypeLabel';
import PublishedLabel from 'src/components/Label/reusable/PublishedLabel';

export type OnClickHandler = MouseEventHandler<HTMLElement>;

export type Type =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'default'
  | 'primary'
  | 'secondary';

export interface LabelProps extends HTMLAttributes<HTMLSpanElement> {
  key?: string;
  className?: string;
  onClick?: OnClickHandler;
  type?: Type;
  style?: CSSProperties;
  children?: ReactNode;
  role?: string;
  monospace?: boolean;
  icon?: ReactNode;
}

export default function Label(props: LabelProps) {
  const theme = useTheme();
  const { colors, transitionTiming } = theme;
  const {
    type = 'default',
    monospace = false,
    style,
    onClick,
    children,
    icon,
    ...rest
  } = props;
  const { primary, secondary, grayscale, success, warning, error, info } =
    colors;

  let baseColor;
  if (type === 'primary') {
    baseColor = primary;
  } else if (type === 'secondary') {
    baseColor = secondary;
  } else if (type === 'success') {
    baseColor = success;
  } else if (type === 'warning') {
    baseColor = warning;
  } else if (type === 'danger') {
    baseColor = error;
  } else if (type === 'info') {
    baseColor = info;
  } else {
    baseColor = grayscale;
  }
  const color = baseColor.dark2;
  let borderColor = baseColor.light1;
  let backgroundColor = baseColor.light2;

  // TODO - REMOVE IF BLOCK LOGIC WHEN shades are fixed to be aligned in terms of brightness
  // currently shades for >=light2 are not aligned for primary, default and secondary
  if (['default', 'primary', 'secondary'].includes(type)) {
    // @ts-ignore
    backgroundColor = baseColor.light4;
    borderColor = baseColor.light2;
  }

  const backgroundColorHover = onClick ? baseColor.light1 : backgroundColor;
  const borderColorHover = onClick ? baseColor.base : borderColor;

  if (type === 'default') {
    // Lighter for default
    backgroundColor = grayscale.light3;
  }

  const css = {
    transition: `background-color ${transitionTiming}s`,
    whiteSpace: 'nowrap',
    cursor: onClick ? 'pointer' : 'default',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    backgroundColor,
    borderRadius: 8,
    borderColor,
    padding: '0.35em 0.8em',
    lineHeight: 1,
    color,
    display: 'inline-flex',
    verticalAlign: 'middle',
    alignItems: 'center',
    maxWidth: '100%',
    '&:hover': {
      backgroundColor: backgroundColorHover,
      borderColor: borderColorHover,
      opacity: 1,
    },
    ...(monospace
      ? { 'font-family': theme.typography.families.monospace }
      : {}),
  };

  return (
    <Tag
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={style}
      icon={icon}
      {...rest}
      css={css}
    >
      {children}
    </Tag>
  );
}
export { DatasetTypeLabel, PublishedLabel };
