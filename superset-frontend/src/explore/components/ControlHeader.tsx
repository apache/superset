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
import { FC, ReactNode, useId } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, useTheme, SupersetTheme } from '@apache-superset/core/theme';
import { FormLabel, InfoTooltip, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';

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
  // WCAG 3.3.1: error container ID shared with the input's aria-describedby.
  // Passed in by wrappers like NumberControl/TextControl so there is exactly
  // one live-region and one DOM id per control (no duplicate ids/alerts).
  errorId?: string;
};

const iconStyles = css`
  &.anticon {
    font-size: unset;
    overflow: visible;
    display: inline-block;
    vertical-align: middle;
    line-height: 1;
    padding-bottom: 0.1em;
    .anticon {
      line-height: unset;
      vertical-align: unset;
      overflow: visible;
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
  errorId: providedErrorId,
}) => {
  const theme = useTheme();
  const uniqueId = useId();
  const errorId = providedErrorId ?? `${name || uniqueId}-error`;

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
          padding-left: ${theme.sizeUnit}px;
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
  };

  return (
    <div className="ControlHeader" data-test={`${name}-header`}>
      <div className="pull-left">
        <FormLabel
          css={(theme: SupersetTheme) => css`
            margin-bottom: ${theme.sizeUnit * 0.5}px;
            position: relative;
            font-size: ${theme.fontSizeSM}px;
            overflow: visible;
            padding-bottom: 0.1em;
          `}
          htmlFor={name}
        >
          {leftNode && <span>{leftNode} </span>}
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
                <Icons.WarningOutlined
                  iconColor={theme.colorWarning}
                  css={css`
                    vertical-align: baseline;
                  `}
                  iconSize="s"
                />
              </Tooltip>{' '}
            </span>
          )}
          {danger && (
            <span>
              <Tooltip id="error-tooltip" placement="top" title={danger}>
                <Icons.CloseCircleOutlined
                  iconColor={theme.colorErrorText}
                  iconSize="s"
                />
              </Tooltip>{' '}
            </span>
          )}
          {validationErrors?.length > 0 && (
            <span
              data-test="error-tooltip"
              css={css`
                cursor: pointer;
              `}
            >
              <Tooltip
                id="error-tooltip"
                placement="top"
                title={validationErrors?.join(' ')}
              >
                <Icons.ExclamationCircleOutlined
                  iconColor={theme.colorError}
                  aria-hidden="true"
                />
              </Tooltip>
              <span
                id={errorId}
                role="alert"
                css={css`
                  position: absolute;
                  width: 1px;
                  height: 1px;
                  padding: 0;
                  margin: -1px;
                  overflow: hidden;
                  clip: rect(0, 0, 0, 0);
                  white-space: nowrap;
                  border: 0;
                `}
              >
                {validationErrors?.join('. ')}
              </span>{' '}
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
