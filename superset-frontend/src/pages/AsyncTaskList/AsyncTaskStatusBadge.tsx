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
import { styled } from '@apache-superset/core/ui';
import { t } from '@superset-ui/core';

interface AsyncTaskStatusBadgeProps {
  status: string;
}

const StatusBadge = styled.span<{ status: string }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;

  ${({ status, theme }) => {
    switch (status) {
      case 'pending':
        return `
          background-color: ${theme.colorWarningBg || theme.colorBgLayout};
          color: ${theme.colorWarning};
        `;
      case 'running':
        return `
          background-color: ${theme.colorPrimaryBg};
          color: ${theme.colorInfo};
        `;
      case 'completed':
        return `
          background-color: ${theme.colorSuccessBg || theme.colorBgLayout};
          color: ${theme.colorSuccess};
        `;
      case 'failed':
        return `
          background-color: ${theme.colorErrorBg || theme.colorBgLayout};
          color: ${theme.colorError};
        `;
      case 'cancelled':
        return `
          background-color: ${theme.colorBgContainerDisabled};
          color: ${theme.colorTextDisabled};
        `;
      default:
        return `
          background-color: ${theme.colorBgContainerDisabled};
          color: ${theme.colorTextDisabled};
        `;
    }
  }}
`;

const getStatusText = (status: string): string => {
  switch (status) {
    case 'pending':
      return t('Pending');
    case 'running':
      return t('Running');
    case 'completed':
      return t('Completed');
    case 'failed':
      return t('Failed');
    case 'cancelled':
      return t('Cancelled');
    default:
      return t('Unknown');
  }
};

export default function AsyncTaskStatusBadge({ status }: AsyncTaskStatusBadgeProps) {
  return (
    <StatusBadge status={status}>
      {getStatusText(status)}
    </StatusBadge>
  );
}
