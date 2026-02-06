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
import { css, styled, t, useTheme } from '@apache-superset/core/ui';
import { Tooltip } from '@superset-ui/core/components';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { Icons } from '@superset-ui/core/components/Icons';

import { ActivityItem as ActivityItemType } from './types';

const Row = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  padding: ${({ theme }) => theme.sizeUnit * 3}px;
  border-bottom: 1px solid ${({ theme }) => theme.colorBorder};
`;

const IconWrapper = styled.div`
  width: ${({ theme }) => theme.sizeUnit * 8}px;
  height: ${({ theme }) => theme.sizeUnit * 8}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const Content = styled.div`
  min-width: 0;
`;

const Action = styled.div`
  color: ${({ theme }) => theme.colorText};
`;

const UserName = styled.span`
  font-weight: ${({ theme }) => theme.fontWeightStrong};
`;

const Timestamp = styled.div`
  color: ${({ theme }) => theme.colorTextDescription};
  margin-top: ${({ theme }) => theme.sizeUnit}px;
`;

function getActionIcon(category: ActivityItemType['action_category']) {
  switch (category) {
    case 'view':
      return Icons.EyeOutlined;
    case 'edit':
      return Icons.EditOutlined;
    case 'export':
      return Icons.DownloadOutlined;
    case 'chart_interaction':
      return Icons.SyncOutlined;
    default:
      return Icons.UserOutlined;
  }
}

function getCategoryColors(
  category: ActivityItemType['action_category'],
  theme: ReturnType<typeof useTheme>,
) {
  switch (category) {
    case 'view':
      return { bg: theme.colorInfoBg, fg: theme.colorInfo };
    case 'edit':
      return { bg: theme.colorWarningBg, fg: theme.colorWarning };
    case 'export':
      return { bg: theme.colorSuccessBg, fg: theme.colorSuccess };
    case 'chart_interaction':
      return { bg: theme.colorPrimaryBg, fg: theme.colorPrimary };
    default:
      return { bg: theme.colorFillSecondary, fg: theme.colorTextDescription };
  }
}

function getDisplayUserName(item: ActivityItemType): string {
  const firstName = item.user.first_name?.trim();
  const lastName = item.user.last_name?.trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  return fullName || item.user.username || t('Anonymous');
}

interface ActivityItemProps {
  item: ActivityItemType;
}

export default function ActivityItem({ item }: ActivityItemProps) {
  const theme = useTheme();
  const Icon = getActionIcon(item.action_category);
  const colorTokens = getCategoryColors(item.action_category, theme);

  const displayName = getDisplayUserName(item);
  const relativeTime = extendedDayjs(item.timestamp).fromNow();
  const fullTime = extendedDayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss');
  const firstSeen = extendedDayjs(item.first_seen).format('YYYY-MM-DD HH:mm:ss');
  const lastSeen = extendedDayjs(item.last_seen).format('YYYY-MM-DD HH:mm:ss');
  const displayAction =
    item.event_count > 1
      ? t('%s (%s times)', item.action_display, item.event_count)
      : item.action_display;
  const tooltipContent =
    item.event_count > 1
      ? t('Latest: %s | First: %s', lastSeen, firstSeen)
      : fullTime;

  return (
    <Row data-test="dashboard-activity-item">
      <IconWrapper
        css={css`
          background: ${colorTokens.bg};
          color: ${colorTokens.fg};
        `}
      >
        <Icon iconSize="m" />
      </IconWrapper>
      <Content>
        <Action>
          <UserName>{displayName}</UserName> {displayAction}
        </Action>
        <Tooltip title={tooltipContent}>
          <Timestamp>{relativeTime}</Timestamp>
        </Tooltip>
      </Content>
    </Row>
  );
}
