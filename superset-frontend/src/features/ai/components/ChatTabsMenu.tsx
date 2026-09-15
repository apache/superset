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

/**
 * @fileoverview The conversation list.
 *
 * Conversations live behind one menu rather than a tab strip: the panel is narrow
 * enough in floating mode that a strip would truncate every name, and the list
 * doubles as the history of past conversations, which a strip cannot be.
 */

import { useCallback, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Button, Dropdown, Popconfirm } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { ChatTab } from '../types';

const MenuContainer = styled.div`
  background: ${({ theme }) => theme.colorBgElevated};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  box-shadow: ${({ theme }) => theme.boxShadowSecondary};
  min-width: ${({ theme }) => theme.sizeUnit * 65}px;
  max-height: ${({ theme }) => theme.sizeUnit * 100}px;
  overflow-y: auto;
  border: 1px solid ${({ theme }) => theme.colorBorderSecondary};
`;

const MenuHeader = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 3}px
    ${({ theme }) => theme.sizeUnit * 4}px;
  border-bottom: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorTextSecondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const NewChatButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  width: 100%;
  padding: ${({ theme }) => theme.sizeUnit * 2.5}px
    ${({ theme }) => theme.sizeUnit * 4}px;
  cursor: pointer;
  color: ${({ theme }) => theme.colorPrimary};
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  background: none;
  border: none;
  text-align: left;
  transition: background ${({ theme }) => theme.motionDurationMid};

  &:hover {
    background: ${({ theme }) => theme.colorFillTertiary};
  }
`;

const TabItem = styled.div<{ isActive: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.sizeUnit * 2.5}px
    ${({ theme }) => theme.sizeUnit * 4}px;
  cursor: pointer;
  background: ${({ theme, isActive }) =>
    isActive ? theme.colorFillSecondary : 'transparent'};
  border-left: 3px solid
    ${({ theme, isActive }) => (isActive ? theme.colorPrimary : 'transparent')};
  transition: background ${({ theme }) => theme.motionDurationMid};

  &:hover {
    background: ${({ theme }) => theme.colorFillTertiary};

    .action-btn {
      opacity: 1;
    }
  }
`;

const TabInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  flex: 1;
  overflow: hidden;
`;

const TabName = styled.span`
  font-size: ${({ theme }) => theme.fontSize}px;
  color: ${({ theme }) => theme.colorText};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: ${({ theme }) => theme.sizeUnit * 35}px;
`;

const TabNameInput = styled.input`
  width: 100%;
  max-width: ${({ theme }) => theme.sizeUnit * 40}px;
  font-size: ${({ theme }) => theme.fontSize}px;
  color: ${({ theme }) => theme.colorText};
  background: ${({ theme }) => theme.colorBgContainer};
  border: 1px solid ${({ theme }) => theme.colorBorder};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  padding: 2px ${({ theme }) => theme.sizeUnit * 1.5}px;
`;

const TabTimestamp = styled.span`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorTextQuaternary};
  white-space: nowrap;
  flex-shrink: 0;
`;

const ActionButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`;

const ActionButton = styled.button`
  background: none;
  border: none;
  padding: ${({ theme }) => theme.sizeUnit}px;
  cursor: pointer;
  color: ${({ theme }) => theme.colorTextSecondary};
  opacity: 0;
  transition: all ${({ theme }) => theme.motionDurationMid};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.borderRadius}px;

  &:hover,
  &:focus-visible {
    opacity: 1;
    color: ${({ theme }) => theme.colorError};
    background: ${({ theme }) => theme.colorErrorBg};
  }
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colorBorderSecondary};
  margin: ${({ theme }) => theme.sizeUnit}px 0;
`;

const EmptyState = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 5}px
    ${({ theme }) => theme.sizeUnit * 4}px;
  text-align: center;
  color: ${({ theme }) => theme.colorTextSecondary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

const MINUTE_SECONDS = 60;
const HOUR_MINUTES = 60;
const DAY_HOURS = 24;
const WEEK_DAYS = 7;

export const formatRelativeTime = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < MINUTE_SECONDS) {
    return t('just now');
  }
  const minutes = Math.floor(seconds / MINUTE_SECONDS);
  if (minutes < HOUR_MINUTES) {
    return t('%sm', String(minutes));
  }
  const hours = Math.floor(minutes / HOUR_MINUTES);
  if (hours < DAY_HOURS) {
    return t('%sh', String(hours));
  }
  const days = Math.floor(hours / DAY_HOURS);
  if (days < WEEK_DAYS) {
    return t('%sd', String(days));
  }
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

interface ChatTabsMenuProps {
  tabs: ChatTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onNewChat: () => void;
  onDeleteTab: (tabId: string) => void;
  onRenameTab: (tabId: string, name: string) => void;
}

export const ChatTabsMenu = ({
  tabs,
  activeTabId,
  onSelectTab,
  onNewChat,
  onDeleteTab,
  onRenameTab,
}: ChatTabsMenuProps) => {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const startEditing = useCallback((event: ReactMouseEvent, tab: ChatTab) => {
    event.stopPropagation();
    setEditingTabId(tab.id);
    setEditingName(tab.name);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingTabId(null);
    setEditingName('');
  }, []);

  const commitRename = useCallback(
    (tabId: string) => {
      const trimmedName = editingName.trim();
      if (trimmedName) {
        onRenameTab(tabId, trimmedName);
      }
      cancelEditing();
    },
    [cancelEditing, editingName, onRenameTab],
  );

  const menuContent = (
    <MenuContainer data-test="chat-tabs-menu">
      <MenuHeader>{t('Conversations')}</MenuHeader>
      <NewChatButton type="button" onClick={onNewChat}>
        <Icons.PlusOutlined iconSize="s" />
        <span>{t('New Chat')}</span>
      </NewChatButton>
      <Divider />
      {tabs.length === 0 ? (
        <EmptyState>{t('No conversations yet')}</EmptyState>
      ) : (
        tabs.map(tab => (
          <TabItem
            key={tab.id}
            isActive={tab.id === activeTabId}
            onClick={() => onSelectTab(tab.id)}
          >
            <TabInfo>
              <Icons.MessageOutlined iconSize="s" />
              {editingTabId === tab.id ? (
                <TabNameInput
                  autoFocus
                  value={editingName}
                  onChange={event => setEditingName(event.target.value)}
                  onClick={event => event.stopPropagation()}
                  onBlur={() => commitRename(tab.id)}
                  onKeyDown={event => {
                    event.stopPropagation();
                    if (event.key === 'Enter') {
                      commitRename(tab.id);
                    } else if (event.key === 'Escape') {
                      cancelEditing();
                    }
                  }}
                  aria-label={t('Conversation name')}
                />
              ) : (
                <TabName>{tab.name}</TabName>
              )}
              {tab.updatedAt !== undefined && (
                <TabTimestamp>{formatRelativeTime(tab.updatedAt)}</TabTimestamp>
              )}
            </TabInfo>
            <ActionButtons>
              <ActionButton
                type="button"
                className="action-btn"
                onClick={event => startEditing(event, tab)}
                title={t('Rename conversation')}
                aria-label={t('Rename conversation')}
              >
                <Icons.EditOutlined iconSize="s" />
              </ActionButton>
              {/* A conversation with messages is confirmed before deletion; an
                  empty one is discarded without a prompt. */}
              {tab.messages.length > 0 || (tab.messageCount ?? 0) > 0 ? (
                <Popconfirm
                  title={t('Delete this conversation?')}
                  description={t('This cannot be undone.')}
                  okText={t('Delete')}
                  cancelText={t('Cancel')}
                  onConfirm={() => onDeleteTab(tab.id)}
                >
                  <ActionButton
                    type="button"
                    className="action-btn"
                    onClick={event => event.stopPropagation()}
                    title={t('Delete conversation')}
                    aria-label={t('Delete conversation')}
                  >
                    <Icons.DeleteOutlined iconSize="s" />
                  </ActionButton>
                </Popconfirm>
              ) : (
                <ActionButton
                  type="button"
                  className="action-btn"
                  onClick={event => {
                    event.stopPropagation();
                    onDeleteTab(tab.id);
                  }}
                  title={t('Delete conversation')}
                  aria-label={t('Delete conversation')}
                >
                  <Icons.DeleteOutlined iconSize="s" />
                </ActionButton>
              )}
            </ActionButtons>
          </TabItem>
        ))
      )}
    </MenuContainer>
  );

  return (
    <Dropdown
      dropdownRender={() => menuContent}
      trigger={['click']}
      placement="bottomLeft"
    >
      <Button
        buttonStyle="link"
        icon={<Icons.MenuOutlined iconSize="m" />}
        aria-label={t('Conversation history')}
        tooltip={t('Conversation history')}
        data-test="chat-tabs-trigger"
      />
    </Dropdown>
  );
};

export default ChatTabsMenu;
