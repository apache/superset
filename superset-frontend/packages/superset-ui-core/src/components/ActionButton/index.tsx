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

import type { ReactElement, ReactNode } from 'react';
import cx from 'classnames';
import { Tooltip, type TooltipPlacement } from '@superset-ui/core/components';
import { css, useTheme } from '@apache-superset/core/theme';

export interface ActionProps {
  label: string;
  tooltip?: string | ReactElement;
  placement?: TooltipPlacement;
  icon: ReactNode;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  dataTest?: string;
}

export const ActionButton = ({
  label,
  tooltip,
  placement,
  icon,
  onClick,
  className,
  disabled = false,
  dataTest,
}: ActionProps) => {
  const theme = useTheme();
  const actionButton = (
    <button
      type="button"
      aria-disabled={disabled}
      aria-label={typeof tooltip === 'string' ? tooltip : label}
      css={css`
        appearance: none;
        border: none;
        background: none;
        padding: 0;
        margin: 0;
        font: inherit;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        cursor: pointer;
        color: ${theme.colorIcon};
        margin-right: ${theme.sizeUnit}px;
        &:hover {
          path {
            fill: ${theme.colorPrimary};
          }
        }
        &.disabled {
          color: ${theme.colorTextDisabled};
          cursor: not-allowed;
        }
      `}
      className={cx('action-button', className, { disabled })}
      data-test={dataTest ?? label}
      onClick={disabled ? undefined : onClick}
    >
      {icon}
    </button>
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
