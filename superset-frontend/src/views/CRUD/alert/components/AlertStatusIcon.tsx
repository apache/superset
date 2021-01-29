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
import { styled, t } from '@superset-ui/core';
import React from 'react';
import { Tooltip } from 'src/common/components/Tooltip';
import Icon, { IconName } from 'src/components/Icon';
import { AlertState } from '../types';

const StatusIcon = styled(Icon, {
  shouldForwardProp: prop => prop !== 'status' && prop !== 'isReportEnabled',
})<{ status: string; isReportEnabled: boolean }>`
  color: ${({ status, theme, isReportEnabled }) => {
    switch (status) {
      case AlertState.working:
        return theme.colors.primary.base;
      case AlertState.error:
        return theme.colors.error.base;
      case AlertState.success:
        return isReportEnabled
          ? theme.colors.success.base
          : theme.colors.alert.base;
      case AlertState.noop:
        return theme.colors.success.base;
      case AlertState.grace:
        return theme.colors.alert.base;
      default:
        return theme.colors.grayscale.base;
    }
  }};
`;

export default function AlertStatusIcon({
  state,
  isReportEnabled = false,
}: {
  state: string;
  isReportEnabled: boolean;
}) {
  const lastStateConfig = {
    name: '',
    label: '',
    status: '',
  };
  switch (state) {
    case AlertState.success:
      lastStateConfig.name = isReportEnabled ? 'check' : 'alert-solid-small';
      lastStateConfig.label = isReportEnabled
        ? t('Report sent')
        : t('Alert triggered, notification sent');
      lastStateConfig.status = AlertState.success;
      break;
    case AlertState.working:
      lastStateConfig.name = 'running';
      lastStateConfig.label = isReportEnabled
        ? t('Report sending')
        : t('Alert running');
      lastStateConfig.status = AlertState.working;
      break;
    case AlertState.error:
      lastStateConfig.name = 'x-small';
      lastStateConfig.label = isReportEnabled
        ? t('Report failed')
        : t('Alert failed');
      lastStateConfig.status = AlertState.error;
      break;
    case AlertState.noop:
      lastStateConfig.name = 'check';
      lastStateConfig.label = t('Nothing triggered');
      lastStateConfig.status = AlertState.noop;
      break;
    case AlertState.grace:
      lastStateConfig.name = 'alert-solid-small';
      lastStateConfig.label = t('Alert Triggered, In Grace Period');
      lastStateConfig.status = AlertState.grace;
      break;
    default:
      lastStateConfig.name = 'check';
      lastStateConfig.label = t('Nothing triggered');
      lastStateConfig.status = AlertState.noop;
  }
  return (
    <Tooltip title={lastStateConfig.label} placement="bottomLeft">
      <StatusIcon
        name={lastStateConfig.name as IconName}
        status={lastStateConfig.status}
        isReportEnabled={isReportEnabled}
        viewBox={
          lastStateConfig.name === 'alert-solid-small'
            ? '-6 -6 24 24'
            : '0 0 24 24'
        }
      />
    </Tooltip>
  );
}
