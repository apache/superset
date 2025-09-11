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
import { t, SupersetTheme, useTheme } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import { AlertState } from '../types';

function getStatusColor(
  status: string,
  isReportEnabled: boolean,
  theme: SupersetTheme,
) {
  switch (status) {
    case AlertState.Working:
      return theme.colors.primary.base;
    case AlertState.Error:
      return theme.colors.error.base;
    case AlertState.Success:
      return isReportEnabled
        ? theme.colors.success.base
        : theme.colors.alert.base;
    case AlertState.Noop:
      return theme.colors.success.base;
    case AlertState.Grace:
      return theme.colors.alert.base;
    default:
      return theme.colors.grayscale.base;
  }
}

export default function AlertStatusIcon({
  state,
  isReportEnabled = false,
}: {
  state: string;
  isReportEnabled: boolean;
}) {
  const theme = useTheme();
  const lastStateConfig = {
    icon: Icons.Check,
    label: '',
    status: '',
  };
  switch (state) {
    case AlertState.Success:
      lastStateConfig.icon = isReportEnabled
        ? Icons.Check
        : Icons.AlertSolidSmall;
      lastStateConfig.label = isReportEnabled
        ? t('Report sent')
        : t('Alert triggered, notification sent');
      lastStateConfig.status = AlertState.Success;
      break;
    case AlertState.Working:
      lastStateConfig.icon = Icons.Running;
      lastStateConfig.label = isReportEnabled
        ? t('Report sending')
        : t('Alert running');
      lastStateConfig.status = AlertState.Working;
      break;
    case AlertState.Error:
      lastStateConfig.icon = Icons.XSmall;
      lastStateConfig.label = isReportEnabled
        ? t('Report failed')
        : t('Alert failed');
      lastStateConfig.status = AlertState.Error;
      break;
    case AlertState.Noop:
      lastStateConfig.icon = Icons.Check;
      lastStateConfig.label = t('Nothing triggered');
      lastStateConfig.status = AlertState.Noop;
      break;
    case AlertState.Grace:
      lastStateConfig.icon = Icons.AlertSolidSmall;
      lastStateConfig.label = t('Alert Triggered, In Grace Period');
      lastStateConfig.status = AlertState.Grace;
      break;
    default:
      lastStateConfig.icon = Icons.Check;
      lastStateConfig.label = t('Nothing triggered');
      lastStateConfig.status = AlertState.Noop;
  }
  const Icon = lastStateConfig.icon;
  return (
    <Tooltip title={lastStateConfig.label} placement="bottomLeft">
      <Icon
        iconColor={getStatusColor(
          lastStateConfig.status,
          isReportEnabled,
          theme,
        )}
      />
    </Tooltip>
  );
}
