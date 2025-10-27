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

import type { ReactElement } from 'react';
import {
  Tooltip,
  type TooltipPlacement,
  type IconType,
} from '@superset-ui/core/components';
import { css, useTheme } from '@superset-ui/core';

export interface ActionProps {
  label: string;
  tooltip?: string | ReactElement;
  placement?: TooltipPlacement;
  icon: IconType;
  onClick: () => void;
}

export const ActionButton = ({
  label,
  tooltip,
  placement,
  icon,
  onClick,
}: ActionProps) => {
  const theme = useTheme();
  const actionButton = (
    <span
      role="button"
      tabIndex={0}
      css={css`
        cursor: pointer;
        color: ${theme.colorIcon};
        margin-right: ${theme.sizeUnit}px;
        &:hover {
          path {
            fill: ${theme.colorPrimary};
          }
        }
      `}
      className="action-button"
      data-test={label}
      onClick={onClick}
    >
      {icon}
    </span>
  );

  const tooltipId = `${label.replaceAll(' ', '-').toLowerCase()}-tooltip`;

  return tooltip ? (
    <Tooltip id={tooltipId} title={tooltip} placement={placement}>
      {actionButton}
    </Tooltip>
  ) : (
    actionButton
  );
};
