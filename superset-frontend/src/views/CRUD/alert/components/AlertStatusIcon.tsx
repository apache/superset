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
import React from 'react';
import { t, styled } from '@superset-ui/core';

import Icon, { IconName } from 'src/components/Icon';
import { Tooltip } from 'src/common/components/Tooltip';

const StatusIcon = styled(Icon)<{ status: string }>`
  color: ${({ status, theme }) => {
    switch (status) {
      case 'Working':
        return theme.colors.alert.base;
      case 'Error':
        return theme.colors.error.base;
      case 'Success':
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
    case 'Success':
      lastStateConfig.name = 'check';
      lastStateConfig.label = t('Success');
      lastStateConfig.status = 'Success';
      break;
    case 'Working':
      lastStateConfig.name = 'exclamation';
      lastStateConfig.label = t('Working');
      lastStateConfig.status = 'Working';
      break;
    case 'Error':
      lastStateConfig.name = 'x-small';
      lastStateConfig.label = t('Error');
      lastStateConfig.status = 'Error';
      break;
    default:
      lastStateConfig.name = 'exclamation';
      lastStateConfig.label = t('Working');
      lastStateConfig.status = 'Working';
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
