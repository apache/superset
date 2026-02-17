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
import { useTheme, SupersetTheme, t } from '@apache-superset/core/ui';
import { Icons } from '@superset-ui/core/components/Icons';
import { Tooltip } from '@superset-ui/core/components';
import { TaskStatus } from './types';
import { formatProgressTooltip } from './timeUtils';

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
    case TaskStatus.TimedOut:
      return theme.colorErrorText;
    case TaskStatus.Aborting:
      return theme.colorWarningText;
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
  [TaskStatus.TimedOut]: Icons.ClockCircleOutlined, // Clock to indicate timeout
  [TaskStatus.Aborting]: Icons.LoadingOutlined, // Spinning to show in-progress abort
  [TaskStatus.Aborted]: Icons.StopOutlined,
};

const statusLabels = {
  [TaskStatus.Pending]: t('Pending'),
  [TaskStatus.InProgress]: t('In Progress'),
  [TaskStatus.Success]: t('Success'),
  [TaskStatus.Failure]: t('Failed'),
  [TaskStatus.TimedOut]: t('Timed Out'),
  [TaskStatus.Aborting]: t('Aborting'),
  [TaskStatus.Aborted]: t('Aborted'),
};

interface TaskStatusIconProps {
  status: TaskStatus;
  progressPercent?: number | null;
  progressCurrent?: number | null;
  progressTotal?: number | null;
  durationSeconds?: number | null;
  errorMessage?: string | null;
  exceptionType?: string | null;
}

export default function TaskStatusIcon({
  status,
  progressPercent,
  progressCurrent,
  progressTotal,
  durationSeconds,
  errorMessage,
  exceptionType,
}: TaskStatusIconProps) {
  const theme = useTheme();
  const IconComponent = statusIcons[status];
  const label = statusLabels[status];

  // Build tooltip content based on status
  let tooltipContent: React.ReactNode;
  if (status === TaskStatus.InProgress || status === TaskStatus.Aborting) {
    // Progress tooltip for active tasks (multiline)
    const lines = formatProgressTooltip(
      label,
      progressCurrent,
      progressTotal,
      progressPercent,
      durationSeconds,
    );
    tooltipContent = (
      <>
        {lines.map((line, index) => (
          <React.Fragment key={index}>
            {index > 0 && <br />}
            {line}
          </React.Fragment>
        ))}
      </>
    );
  } else if (
    (status === TaskStatus.Failure || status === TaskStatus.TimedOut) &&
    (exceptionType || errorMessage)
  ) {
    // Error tooltip for failed/timed out tasks: "Label (ExceptionType): message"
    if (exceptionType && errorMessage) {
      tooltipContent = `${label} (${exceptionType}): ${errorMessage}`;
    } else if (exceptionType) {
      tooltipContent = `${label} (${exceptionType})`;
    } else if (errorMessage) {
      tooltipContent = `${label}: ${errorMessage}`;
    } else {
      tooltipContent = label;
    }
  } else {
    tooltipContent = label;
  }

  // Spin for in-progress and aborting states
  const shouldSpin =
    status === TaskStatus.InProgress || status === TaskStatus.Aborting;

  return (
    <Tooltip title={tooltipContent} placement="top">
      <span>
        <IconComponent
          iconSize="l"
          iconColor={getStatusColor(status, theme)}
          spin={shouldSpin}
        />
      </span>
    </Tooltip>
  );
}
