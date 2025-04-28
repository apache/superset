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
import { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { kebabCase } from 'lodash';
import { t } from '@superset-ui/core';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { Tooltip, TooltipProps, TooltipPlacement } from './Tooltip';

export interface InfoTooltipWithTriggerProps {
  label?: string;
  tooltip?: TooltipProps['title'];
  icon?: ReactNode;
  onClick?: () => void;
  placement?: TooltipPlacement;
  className?: string;
  iconsStyle?: CSSProperties;
}

export const InfoTooltipWithTrigger = ({
  label,
  tooltip,
  onClick,
  icon = <ExclamationCircleOutlined />,
  className = 'text-muted',
  placement = 'right',
  iconsStyle = { fontSize: 12 },
}: InfoTooltipWithTriggerProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      onClick();
    }
  };

  const iconEl = (
    <span
      role="button"
      aria-label={t('Show info tooltip')}
      tabIndex={0}
      className={className}
      style={{
        cursor: onClick ? 'pointer' : undefined,
        display: 'inline-flex',
        alignItems: 'center',
        ...iconsStyle,
      }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      {icon}
    </span>
  );

  if (!tooltip) {
    return iconEl;
  }

  return (
    <Tooltip
      id={`${kebabCase(label)}-tooltip`}
      title={tooltip}
      placement={placement}
    >
      {iconEl}
    </Tooltip>
  );
};
