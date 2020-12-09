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

const StatusIcon = styled(Icon)<{ status: string }>`
  color: ${({ status, theme }) => {
    switch (status) {
      case AlertState.working:
        return theme.colors.alert.base;
      case AlertState.error:
        return theme.colors.error.base;
      case AlertState.success:
        return theme.colors.success.base;
      default:
        return theme.colors.grayscale.base;
    }
  }};
`;

export default function AlertStatusIcon({ state }: { state: string }) {
  const lastStateConfig = {
    name: '',
    label: '',
    status: '',
  };
  switch (state) {
    case AlertState.success:
      lastStateConfig.name = 'check';
      lastStateConfig.label = t(`${AlertState.success}`);
      lastStateConfig.status = AlertState.success;
      break;
    case AlertState.working:
      lastStateConfig.name = 'exclamation';
      lastStateConfig.label = t(`${AlertState.working}`);
      lastStateConfig.status = AlertState.working;
      break;
    case AlertState.error:
      lastStateConfig.name = 'x-small';
      lastStateConfig.label = t(`${AlertState.error}`);
      lastStateConfig.status = AlertState.error;
      break;
    default:
      lastStateConfig.name = 'exclamation';
      lastStateConfig.label = t(`${AlertState.working}`);
      lastStateConfig.status = AlertState.working;
  }
  return (
    <Tooltip title={lastStateConfig.label} placement="bottom">
      <StatusIcon
        name={lastStateConfig.name as IconName}
        status={lastStateConfig.status}
      />
    </Tooltip>
  );
}
