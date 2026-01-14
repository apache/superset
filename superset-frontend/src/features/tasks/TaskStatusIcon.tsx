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

import { useTheme, SupersetTheme } from '@apache-superset/core/ui';
import { Icons } from '@superset-ui/core/components/Icons';
import { Tooltip } from '@superset-ui/core/components';
import { TaskStatus } from './types';

function getStatusColor(status: TaskStatus, theme: SupersetTheme): string {
  switch (status) {
    case TaskStatus.Pending:
      return theme.colorPrimaryText;
    case TaskStatus.InProgress:
      return theme.colorPrimaryText;
    case TaskStatus.Success:
      return theme.colorSuccessText;
    case TaskStatus.Failure:
      return theme.colorErrorText;
    case TaskStatus.Aborted:
      return theme.colorWarningText;
    default:
      return theme.colorText;
  }
}

const statusIcons = {
  [TaskStatus.Pending]: Icons.ClockCircleOutlined,
  [TaskStatus.InProgress]: Icons.LoadingOutlined,
  [TaskStatus.Success]: Icons.CheckCircleOutlined,
  [TaskStatus.Failure]: Icons.CloseCircleOutlined,
  [TaskStatus.Aborted]: Icons.StopOutlined,
};

const statusLabels = {
  [TaskStatus.Pending]: 'Pending',
  [TaskStatus.InProgress]: 'In Progress',
  [TaskStatus.Success]: 'Success',
  [TaskStatus.Failure]: 'Failed',
  [TaskStatus.Aborted]: 'Aborted',
};

interface TaskStatusIconProps {
  status: TaskStatus;
  progress?: number | null;
}

export default function TaskStatusIcon({
  status,
  progress,
}: TaskStatusIconProps) {
  const theme = useTheme();
  const IconComponent = statusIcons[status];
  const label = statusLabels[status];

  // Add progress to tooltip if available
  const tooltipText =
    progress !== null && progress !== undefined
      ? `${label}: ${Math.round(progress * 100)}%`
      : label;

  return (
    <Tooltip title={tooltipText} placement="top">
      <span>
        <IconComponent
          iconSize="l"
          iconColor={getStatusColor(status, theme)}
          spin={status === TaskStatus.InProgress}
        />
      </span>
    </Tooltip>
  );
}
