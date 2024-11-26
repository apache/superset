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
import { Alert as AntdAlert, AlertProps as AntdAlertProps } from 'antd-v5';
import { useTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';

export type AlertProps = Omit<AntdAlertProps, 'children'> & {
  roomBelow?: boolean;
} & {
  children?: React.ReactNode;
};

export default function Alert(props: AlertProps) {
  const {
    type = 'info',
    description,
    showIcon = true,
    closable = true,
    roomBelow = false,
    children,
    ...restProps
  } = props;

  const theme = useTheme();
  const { colors, typography, gridUnit } = theme;
  const { alert, error, info, success } = colors;

  let baseColor = info;
  let AlertIcon = Icons.InfoSolid;

  if (type === 'error') {
    baseColor = error;
    AlertIcon = Icons.ErrorSolid;
  } else if (type === 'warning') {
    baseColor = alert;
    AlertIcon = Icons.AlertSolid;
  } else if (type === 'success') {
    baseColor = success;
    AlertIcon = Icons.CircleCheckSolid;
  }

  const alertProps = {
    ...restProps,
    type,
    description,
    showIcon,
    closable,
    icon: showIcon && <AlertIcon aria-label={`${type} icon`} />,
    closeIcon: closable && <Icons.XSmall aria-label="close icon" />,
    css: {
      marginBottom: roomBelow ? gridUnit * 4 : 0,
      padding: `${gridUnit * 2}px ${gridUnit * 3}px`,
      alignItems: 'flex-start',
      border: 0,
      backgroundColor: baseColor.light2,
      '& .antd-v5-alert-icon': {
        marginRight: gridUnit * 2,
      },
      '& .antd-v5-alert-message': {
        color: baseColor.dark2,
        fontSize: typography.sizes.m,
        fontWeight: description
          ? typography.weights.bold
          : typography.weights.normal,
      },
      '& .antd-v5-alert-description': {
        color: baseColor.dark2,
        fontSize: typography.sizes.m,
      },
    },
  } as AntdAlertProps;

  return <AntdAlert {...alertProps}>{children}</AntdAlert>;
}
