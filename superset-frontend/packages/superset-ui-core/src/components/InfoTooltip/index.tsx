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
import { KeyboardEvent, useMemo } from 'react';
import { SerializedStyles, CSSObject } from '@emotion/react';
import { kebabCase } from 'lodash';
import { css, t, useTheme, getFontSize } from '@superset-ui/core';
import {
  CloseCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import { Tooltip, TooltipProps, TooltipPlacement } from '../Tooltip';

export interface InfoTooltipProps {
  label?: string;
  tooltip?: TooltipProps['title'];
  onClick?: () => void;
  placement?: TooltipPlacement;
  className?: string;
  iconStyle?: CSSObject | SerializedStyles;
  type?: 'info' | 'warning' | 'notice' | 'error' | 'question';
  iconSize?: 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl';
}

export const InfoTooltip = ({
  type = 'info',
  iconSize = 's',
  label,
  tooltip,
  onClick,
  className = 'text-muted',
  placement = 'right',
  iconStyle,
}: InfoTooltipProps) => {
  const theme = useTheme();

  const infoTooltipWithTriggerVariants = useMemo(
    () => ({
      info: { color: theme.colorIcon, icon: <InfoCircleOutlined /> },
      question: { color: theme.colorIcon, icon: <QuestionCircleOutlined /> },
      warning: { color: theme.colorWarning, icon: <WarningOutlined /> },
      notice: { color: theme.colorWarning, icon: <ThunderboltOutlined /> },
      error: { color: theme.colorError, icon: <CloseCircleOutlined /> },
    }),
    [theme],
  );

  const variant = type ? infoTooltipWithTriggerVariants[type] : null;

  const iconCss = css`
    color: ${variant?.color ?? theme.colorIcon};
    font-size: ${getFontSize(theme, iconSize)}px;
  `;

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      onClick();
    }
  };

  const iconEl = (
    <Button
      type="text"
      variant="text"
      data-test="info-tooltip-icon"
      aria-label={t('Show info tooltip')}
      className={className}
      css={[
        theme => css`
          vertical-align: text-bottom;
          box-shadow: none;
          padding: 0;
          height: auto;
          background: none;
          &&&:hover,
          &&&:focus,
          &&&:active {
            box-shadow: none;
            background: none;
            outline: none;
            color: ${theme.colorTextTertiary};
          }
          ${onClick ? 'cursor: pointer;' : ''}
        `,
        iconCss,
        iconStyle,
      ]}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      {variant?.icon}
    </Button>
  );

  if (!tooltip) {
    return iconEl;
  }

  return (
    <Tooltip
      id={`${kebabCase(label) || Math.floor(Math.random() * 10000)}-tooltip`}
      title={tooltip}
      placement={placement}
    >
      {iconEl}
    </Tooltip>
  );
};
