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
import React, { PropsWithChildren } from 'react';
import {
  Alert as AntdAlert,
  AlertProps as AntdAlertProps,
} from 'src/common/components';
import { useTheme } from '@superset-ui/core';
import Icon, { IconName } from 'src/components/Icon';

export type AlertProps = PropsWithChildren<AntdAlertProps>;

export default function Alert(props: AlertProps) {
  const {
    type = 'info',
    description,
    showIcon = true,
    closable = true,
    children,
  } = props;

  const theme = useTheme();
  const { colors, typography } = theme;
  const { alert, error, info, success } = colors;

  let baseColor = info;
  let iconName: IconName = 'info-solid';
  if (type === 'error') {
    baseColor = error;
    iconName = 'error-solid';
  } else if (type === 'warning') {
    baseColor = alert;
    iconName = 'alert-solid';
  } else if (type === 'success') {
    baseColor = success;
    iconName = 'circle-check-solid';
  }

  return (
    <AntdAlert
      role="alert"
      showIcon={showIcon}
      icon={<Icon name={iconName} aria-label={`${type} icon`} />}
      closeText={closable && <Icon name="x-small" aria-label="close icon" />}
      css={{
        padding: '6px 10px',
        alignItems: 'flex-start',
        border: 0,
        backgroundColor: baseColor.light2,
        '& .ant-alert-icon': {
          marginRight: 10,
        },
        '& .ant-alert-message': {
          color: baseColor.dark2,
          fontSize: typography.sizes.m,
          fontWeight: description
            ? typography.weights.bold
            : typography.weights.normal,
        },
        '& .ant-alert-description': {
          color: baseColor.dark2,
          fontSize: typography.sizes.m,
        },
      }}
      {...props}
    >
      {children}
    </AntdAlert>
  );
}
