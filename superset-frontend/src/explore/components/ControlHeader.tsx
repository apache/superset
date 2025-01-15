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
import { FC, ReactNode, useMemo, useRef } from 'react';
import { t, css, useTheme, SupersetTheme } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import { Tooltip } from 'src/components/Tooltip';
import { FormLabel } from 'src/components/Form';
import Icons from 'src/components/Icons';

type ValidationError = string;

export type ControlHeaderProps = {
  name?: string;
  label?: ReactNode;
  description?: ReactNode;
  validationErrors?: ValidationError[];
  renderTrigger?: boolean;
  rightNode?: ReactNode;
  leftNode?: ReactNode;
  onClick?: () => void;
  hovered?: boolean;
  tooltipOnClick?: () => void;
  warning?: string;
  danger?: string;
};

const iconStyles = css`
  &.anticon {
    font-size: unset;
    .anticon {
      line-height: unset;
      vertical-align: unset;
    }
  }
`;

const ControlHeader: FC<ControlHeaderProps> = ({
  name,
  label,
  description,
  validationErrors = [],
  renderTrigger = false,
  rightNode,
  leftNode,
  onClick,
  hovered = false,
  tooltipOnClick = () => {},
  warning,
  danger,
}) => {
  const { gridUnit, colors } = useTheme();
  const hasHadNoErrors = useRef(false);
  const labelColor = useMemo(() => {
    if (!validationErrors.length) {
      hasHadNoErrors.current = true;
    }

    if (hasHadNoErrors.current) {
      if (validationErrors.length) {
        return colors.error.base;
      }

      return 'unset';
    }

    return colors.warning.base;
  }, [colors.error.base, colors.warning.base, validationErrors.length]);

  if (!label) {
    return null;
  }

  const renderOptionalIcons = () => {
    if (!hovered) {
      return null;
    }

    return (
      <span
        css={() => css`
          position: absolute;
          top: 50%;
          right: 0;
          padding-left: ${gridUnit}px;
          transform: translate(100%, -50%);
          white-space: nowrap;
        `}
      >
        {description && (
          <span>
            <Tooltip
              id="description-tooltip"
              title={description}
              placement="top"
            >
              <Icons.InfoCircleOutlined
                css={iconStyles}
                onClick={tooltipOnClick}
              />
            </Tooltip>{' '}
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
  };

  return (
    <div className="ControlHeader" data-test={`${name}-header`}>
      <div className="pull-left">
        <FormLabel
          css={(theme: SupersetTheme) => css`
            margin-bottom: ${theme.gridUnit * 0.5}px;
            position: relative;
          `}
        >
          {leftNode && <span>{leftNode}</span>}
          <span
            role="button"
            tabIndex={0}
            onClick={onClick}
            style={{ cursor: onClick ? 'pointer' : '' }}
          >
            {label}
          </span>{' '}
          {warning && (
            <span>
              <Tooltip id="error-tooltip" placement="top" title={warning}>
                <Icons.AlertSolid
                  iconColor={colors.warning.base}
                  iconSize="s"
                />
              </Tooltip>{' '}
            </span>
          )}
          {danger && (
            <span>
              <Tooltip id="error-tooltip" placement="top" title={danger}>
                <Icons.ErrorSolid iconColor={colors.error.base} iconSize="s" />
              </Tooltip>{' '}
            </span>
          )}
          {validationErrors?.length > 0 && (
            <span data-test="error-tooltip">
              <Tooltip
                id="error-tooltip"
                placement="top"
                title={validationErrors?.join(' ')}
              >
                <Icons.ExclamationCircleOutlined
                  css={css`
                    ${iconStyles};
                    color: ${labelColor};
                  `}
                />
              </Tooltip>{' '}
            </span>
          )}
          {renderOptionalIcons()}
        </FormLabel>
      </div>
      {rightNode && <div className="pull-right">{rightNode}</div>}
      <div className="clearfix" />
    </div>
  );
};

export default ControlHeader;
