/*
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

import { useTheme } from '@superset-ui/core';
import { Tooltip as BaseTooltip } from 'antd-v5';
import {
  TooltipProps as BaseTooltipProps,
  TooltipPlacement as BaseTooltipPlacement,
} from 'antd-v5/es/tooltip';

export type TooltipProps = BaseTooltipProps;
export type TooltipPlacement = BaseTooltipPlacement;

export const Tooltip = ({
  overlayStyle = {},
  color,
  ...props
}: BaseTooltipProps) => {
  const theme = useTheme();
  const defaultColor = `${theme.colors.grayscale.dark2}e6`;
  return (
    <BaseTooltip
      styles={{
        root: {
          fontSize: theme.fontSizeSM,
          lineHeight: '1.6',
          maxWidth: theme.sizeUnit * 62,
          minWidth: theme.sizeUnit * 30,
          ...overlayStyle,
        },
      }}
      color={defaultColor || color}
      trigger="hover"
      placement="bottom"
      // don't allow hovering over the tooltip
      mouseLeaveDelay={0}
      {...props}
    />
  );
};

export default Tooltip;
