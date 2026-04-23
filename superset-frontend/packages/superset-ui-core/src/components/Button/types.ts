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

import type { MouseEventHandler, ReactNode } from 'react';
import type {
  ButtonProps as AntdButtonProps,
  ButtonType,
  ButtonVariantType,
  ButtonColorType,
} from 'antd/es/button';
import { IconType } from '@superset-ui/core/components/Icons/types';
import type { TooltipPlacement } from '../Tooltip/types';

export type { AntdButtonProps, ButtonType, ButtonVariantType, ButtonColorType };

export type OnClickHandler = MouseEventHandler<HTMLElement>;

export type ButtonStyle =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'danger'
  | 'link'
  | 'dashed';

export type ButtonSize = 'default' | 'small' | 'xsmall';

export type ButtonProps = Omit<AntdButtonProps, 'css'> & {
  placement?: TooltipPlacement;
  tooltip?: ReactNode;
  className?: string;
  buttonSize?: ButtonSize;
  buttonStyle?: ButtonStyle;
  cta?: boolean;
  showMarginRight?: boolean;
  icon?: IconType;
};
