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
import { t } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from './InfoTooltipWithTrigger';
import { Tooltip } from './Tooltip';

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

export default function ControlHeader({
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
              <InfoTooltipWithTrigger
                label={t('description')}
                tooltip={description}
                placement="top"
                onClick={tooltipOnClick}
              />{' '}
            </span>
          )}
          {renderTrigger && (
            <span>
              <InfoTooltipWithTrigger
                label={t('bolt')}
                tooltip={t('Changing this control takes effect instantly')}
                placement="top"
                icon="bolt"
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
          {leftNode && <span>{leftNode}</span>}
          <span
            role="button"
            tabIndex={0}
            onClick={onClick}
            className={labelClass}
            style={{ cursor: onClick ? 'pointer' : '' }}
          >
            {label}
          </span>{' '}
          {warning && (
            <span>
              <Tooltip id="error-tooltip" placement="top" title={warning}>
                <i className="fa fa-exclamation-circle text-warning" />
              </Tooltip>{' '}
            </span>
          )}
          {danger && (
            <span>
              <Tooltip id="error-tooltip" placement="top" title={danger}>
                <i className="fa fa-exclamation-circle text-danger" />
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
                <i className="fa fa-exclamation-circle text-danger" />
              </Tooltip>{' '}
            </span>
          )}
          {renderOptionalIcons()}
          {required && (
            <span className="text-danger m-l-4">
              <strong>*</strong>
            </span>
          )}
        </label>
      </div>
      {rightNode && <div className="pull-right">{rightNode}</div>}
      <div className="clearfix" />
    </div>
  );
}
