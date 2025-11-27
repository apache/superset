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
import { FC, ReactNode } from 'react';
import { t } from '@superset-ui/core';
import { css, useTheme, SupersetTheme } from '@apache-superset/core/ui';
import { FormLabel, InfoTooltip, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { GlossaryTooltip, type GlossaryTerm } from '@superset-ui/core/components';
type ValidationError = string;

export type ControlHeaderProps = {
  name?: string;
  label?: ReactNode;
  description?: ReactNode;
  validationErrors?: ValidationError[];
  renderTrigger?: boolean;
  rightNode?: ReactNode;
  leftNode?: ReactNode;
  glossaryTerm?: GlossaryTerm;
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
  glossaryTerm,
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
  const theme = useTheme();

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
            <GlossaryTooltip term={glossaryTerm} title={description}>
              <Icons.InfoCircleOutlined
                css={iconStyles}
              />
            </GlossaryTooltip>{' '}
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
                <Icons.ExclamationCircleOutlined iconColor={theme.colorError} />
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
