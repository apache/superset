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
import { PropsWithChildren } from 'react';
import { Alert as AntdAlert } from 'antd-v5';
import { AlertProps as AntdAlertProps } from 'antd-v5/lib/alert';
import { css, useTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';

export type AlertProps = PropsWithChildren<
  Omit<AntdAlertProps, 'children'> & { roomBelow?: boolean }
>;

export default function Alert(props: AlertProps) {
  const {
    type = 'info',
    description,
    showIcon = true,
    closable = true,
    roomBelow = false,
    children,
  } = props;

  const theme = useTheme();
  const { colors } = theme;
  const { alert: alertColor, error, info, success } = colors;

  let baseColor = info;
  let AlertIcon = Icons.InfoSolid;
  if (type === 'error') {
    baseColor = error;
    AlertIcon = Icons.ErrorSolid;
  } else if (type === 'warning') {
    baseColor = alertColor;
    AlertIcon = Icons.AlertSolid;
  } else if (type === 'success') {
    baseColor = success;
    AlertIcon = Icons.CircleCheckSolid;
  }

  return (
    <AntdAlert
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      showIcon={showIcon}
      icon={
        showIcon && (
          <span
            role="img"
            aria-label={`${type} icon`}
            style={{
              color: baseColor.base,
            }}
          >
            <AlertIcon />
          </span>
        )
      }
      closeIcon={closable && <Icons.XSmall aria-label="close icon" />}
      message={children || 'Default message'}
      description={description}
      css={css`
        margin-bottom: ${roomBelow ? theme.gridUnit * 4 : 0}px;
        a {
          text-decoration: underline;
        }
        .antd5-alert-message {
          font-weight: ${description
            ? theme.typography.weights.bold
            : 'inherit'};
        }
      `}
      {...props}
    />
  );
}
