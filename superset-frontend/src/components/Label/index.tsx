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
import React, { CSSProperties } from 'react';
import { Tag } from 'src/components';
import { useTheme } from '@superset-ui/core';

export type OnClickHandler = React.MouseEventHandler<HTMLElement>;

export type Type =
  | 'alert'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'default'
  | 'primary'
  | 'secondary';

export interface LabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  key?: string;
  className?: string;
  onClick?: OnClickHandler;
  type?: Type;
  style?: CSSProperties;
  children?: React.ReactNode;
  role?: string;
}

export default function Label(props: LabelProps) {
  const theme = useTheme();
  const { colors, transitionTiming } = theme;
  const { type = 'default', onClick, children, ...rest } = props;
  const {
    alert,
    primary,
    secondary,
    grayscale,
    success,
    warning,
    error,
    info,
  } = colors;

  let backgroundColor = grayscale.light3;
  let backgroundColorHover = onClick ? primary.light2 : grayscale.light3;
  let borderColor = onClick ? grayscale.light2 : 'transparent';
  let borderColorHover = onClick ? primary.light1 : 'transparent';
  let color = grayscale.dark1;

  if (type !== 'default') {
    color = grayscale.light4;

    let baseColor;
    if (type === 'alert') {
      color = grayscale.dark1;
      baseColor = alert;
    } else if (type === 'success') {
      baseColor = success;
    } else if (type === 'warning') {
      baseColor = warning;
    } else if (type === 'danger') {
      baseColor = error;
    } else if (type === 'info') {
      baseColor = info;
    } else if (type === 'secondary') {
      baseColor = secondary;
    } else {
      baseColor = primary;
    }

    backgroundColor = baseColor.base;
    backgroundColorHover = onClick ? baseColor.dark1 : baseColor.base;
    borderColor = onClick ? baseColor.dark1 : 'transparent';
    borderColorHover = onClick ? baseColor.dark2 : 'transparent';
  }

  return (
    <Tag
      onClick={onClick}
      {...rest}
      css={{
        transition: `background-color ${transitionTiming}s`,
        whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        backgroundColor,
        borderColor,
        borderRadius: 21,
        padding: '0.35em 0.8em',
        lineHeight: 1,
        color,
        maxWidth: '100%',
        '&:hover': {
          backgroundColor: backgroundColorHover,
          borderColor: borderColorHover,
          opacity: 1,
        },
      }}
    >
      {children}
    </Tag>
  );
}
