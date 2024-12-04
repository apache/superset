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
import { supersetTheme } from '@superset-ui/core';
import { Tooltip as AntdTooltip } from 'antd-v5';
import {
  TooltipProps as AntdTooltipProps,
  TooltipPlacement as AntdTooltipPlacement,
} from 'antd-v5/lib/tooltip';

export type TooltipPlacement = AntdTooltipPlacement;
export type TooltipProps = AntdTooltipProps;

export const Tooltip = (props: TooltipProps) => (
  <>
    <AntdTooltip
      overlayInnerStyle={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
      color={`${supersetTheme.colors.grayscale.dark2}e6`}
      {...props}
    />
  </>
);
