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

import React, { ReactNode } from 'react';
import { css, SupersetTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';

export const MenuItemTooltip = ({
  title,
  color,
}: {
  title: ReactNode;
  color?: string;
}) => (
  <Tooltip title={title} placement="top">
    <Icons.InfoCircleOutlined
      data-test="tooltip-trigger"
      css={(theme: SupersetTheme) => css`
        color: ${color || theme.colors.text.label};
        margin-left: ${theme.gridUnit * 2}px;
        &.anticon {
          font-size: unset;
          .anticon {
            line-height: unset;
            vertical-align: unset;
          }
        }
      `}
    />
  </Tooltip>
);
