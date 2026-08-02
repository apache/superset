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
import React, { ReactNode } from 'react';
import { Button, Flex, Tag, Tooltip, Typography } from 'antd';
import {
  ClearOutlined,
  CloseOutlined,
  CompressOutlined,
  ExpandOutlined,
  MinusSquareOutlined,
  PlusSquareOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { theme, translation } from '@apache-superset/core';
import { pageLabel } from '../hooks/usePage';
import type { NavigationScope } from '../hooks/usePageNavigationNote';
import type { DisplayMode, Page } from '../types';

const { t } = translation;
const { useTheme } = theme;

function HeaderButton({
  icon,
  label,
  onClick,
  testId,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  testId: string;
  disabled?: boolean;
}) {
  return (
    <Tooltip title={label}>
      <Button
        size="small"
        type="text"
        icon={icon}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        data-test={testId}
      />
    </Tooltip>
  );
}

/**
 * What the assistant is scoped to: the entity in view when there is one,
 * otherwise the page. List pages have no entity and show the page label.
 */
function scopeLabel(page: Page, scope: NavigationScope['scope']): string {
  if (!scope) return pageLabel(page);
  const kind: Record<NonNullable<typeof scope>['kind'], string> = {
    dashboard: t('Dashboard'),
    chart: t('Chart'),
    dataset: t('Dataset'),
  };
  return `${kind[scope.kind]} - ${scope.name}`;
}

interface ChatHeaderProps {
  page: Page;
  scope: NavigationScope['scope'];
  mode: DisplayMode;
  /** False on an empty transcript, where there is nothing to collapse */
  hasContent: boolean;
  /** True once collapsed, so the button offers to reopen the transcript */
  collapsed: boolean;
  onToggleCollapseAll: () => void;
  onNewConversation: () => void;
  onToggleMode: () => void;
  onClose: () => void;
}

/** Panel title bar: the scope tag plus the panel controls */
export default function ChatHeader({
  page,
  scope,
  mode,
  hasContent,
  collapsed,
  onToggleCollapseAll,
  onNewConversation,
  onToggleMode,
  onClose,
}: ChatHeaderProps) {
  const theme = useTheme();
  const docked = mode === 'panel';
  const toggleLabel = docked ? t('Float the chat') : t('Dock the chat');
  return (
    <Flex
      align="center"
      gap={theme.marginXS}
      style={{
        padding: `${theme.paddingXS}px ${theme.paddingSM}px`,
        borderBottom: `1px solid ${theme.colorBorderSecondary}`,
      }}
    >
      <RobotOutlined aria-hidden />
      <Typography.Text strong style={{ flex: 1 }}>
        {t('AI Assistant')}
      </Typography.Text>
      <Tag
        data-test="chat-page-context"
        // Same tokens as the host's secondary button ("Edit dashboard"), so
        // the scope reads as part of Superset's chrome rather than as its own
        // colour. Set through `style` rather than Tag's `color` prop, which
        // pairs a custom background with white text.
        //
        // The header spaces children with a flex gap, which the Tag's own
        // trailing margin would double. A long entity name is truncated
        // rather than pushing the controls off the edge
        style={{
          color: theme.buttonSecondaryColor || theme.colorPrimary,
          background: theme.buttonSecondaryBg || theme.colorPrimaryBg,
          borderColor: theme.buttonSecondaryBorderColor || 'transparent',
          marginInlineEnd: 0,
          maxWidth: 180,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={scopeLabel(page, scope)}
      >
        {scopeLabel(page, scope)}
      </Tag>
      <HeaderButton
        icon={collapsed ? <PlusSquareOutlined /> : <MinusSquareOutlined />}
        label={collapsed ? t('Expand all') : t('Collapse all')}
        onClick={onToggleCollapseAll}
        testId="chat-collapse-all"
        disabled={!hasContent}
      />
      <HeaderButton
        // Conversations are not stored server-side, so this clears rather
        // than starting something that could be returned to
        icon={<ClearOutlined />}
        label={t('Clear conversation')}
        onClick={onNewConversation}
        testId="chat-new-conversation"
        disabled={!hasContent}
      />
      <HeaderButton
        icon={docked ? <CompressOutlined /> : <ExpandOutlined />}
        label={toggleLabel}
        onClick={onToggleMode}
        testId="chat-mode-toggle"
      />
      <HeaderButton
        icon={<CloseOutlined />}
        label={t('Close chat')}
        onClick={onClose}
        testId="chat-close"
      />
    </Flex>
  );
}
