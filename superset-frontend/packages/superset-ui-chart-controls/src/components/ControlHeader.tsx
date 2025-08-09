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
import { ReactNode } from 'react';
import { t, css } from '@superset-ui/core';
import { InfoTooltip, Tooltip, Icons } from '@superset-ui/core/components';

type ValidationError = string;

export type ControlHeaderProps = {
  name?: string;
  label?: ReactNode;
  description?: ReactNode;
  validationErrors?: ValidationError[];
  renderTrigger?: boolean;
  rightNode?: ReactNode;
  leftNode?: ReactNode;
  hovered?: boolean;
  required?: boolean;
  warning?: string;
  danger?: string;
  onClick?: () => void;
  tooltipOnClick?: () => void;
};

export function ControlHeader({
  name,
  description,
  label,
  tooltipOnClick,
  onClick,
  warning,
  danger,
  leftNode,
  rightNode,
  validationErrors = [],
  renderTrigger = false,
  hovered = false,
  required = false,
}: ControlHeaderProps) {
  const renderOptionalIcons = () => {
    if (hovered) {
      return (
        <span>
          {description && (
            <span>
              <InfoTooltip
                label={t('description')}
                tooltip={description}
                placement="top"
                onClick={tooltipOnClick}
              />{' '}
            </span>
          )}
          {renderTrigger && (
            <span>
              <InfoTooltip
                label={t('bolt')}
                tooltip={t('Changing this control takes effect instantly')}
                placement="top"
                type="notice"
              />{' '}
            </span>
          )}
        </span>
      );
    }
    return null;
  };

  if (!label) {
    return null;
  }
  const labelClass = validationErrors.length > 0 ? 'text-danger' : '';

  return (
    <div className="ControlHeader" data-test={`${name}-header`}>
      <div className="pull-left">
        <label className="control-label" htmlFor={name}>
          {leftNode && <>{leftNode}</>}
          <span
            role={onClick ? 'button' : undefined}
            {...(onClick ? { onClick, tabIndex: 0 } : {})}
            className={labelClass}
          >
            {label}
          </span>{' '}
          {warning && (
            <span>
              <Tooltip id="error-tooltip" placement="top" title={warning}>
                <Icons.InfoCircleOutlined
                  iconSize="m"
                  css={theme => css`
                    color: ${theme.colorError};
                  `}
                />
              </Tooltip>{' '}
            </span>
          )}
          {danger && (
            <span>
              <Tooltip id="error-tooltip" placement="top" title={danger}>
                <Icons.InfoCircleOutlined
                  iconSize="m"
                  css={theme => css`
                    color: ${theme.colorError};
                  `}
                />{' '}
              </Tooltip>{' '}
            </span>
          )}
          {validationErrors.length > 0 && (
            <span>
              <Tooltip
                id="error-tooltip"
                placement="top"
                title={validationErrors.join(' ')}
              >
                <Icons.InfoCircleOutlined
                  iconSize="m"
                  css={theme => css`
                    color: ${theme.colorError};
                  `}
                />{' '}
              </Tooltip>{' '}
            </span>
          )}
          {renderOptionalIcons()}
          {required && <strong> *</strong>}
        </label>
      </div>
      {rightNode && <div className="pull-right">{rightNode}</div>}
      <div className="clearfix" />
    </div>
  );
}
