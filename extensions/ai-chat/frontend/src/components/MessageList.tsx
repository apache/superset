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
import React, { useEffect, useRef } from 'react';
import { Flex, Image, Spin, Tag, Typography } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import { theme, translation } from '@apache-superset/core';
import { referenceKey } from '../utils/entityRef';
import type { DisplayItem, FoldSignal } from '../types';
import AssistantMessage from './AssistantMessage';
import ReferenceTag from './ReferenceTag';
import ToolCallCard from './ToolCallCard';

const { t } = translation;
const { useTheme } = theme;

function MessageBubble({
  item,
  fold,
}: {
  item: Extract<DisplayItem, { kind: 'message' }>;
  fold: FoldSignal;
}) {
  const theme = useTheme();
  const isUser = item.role === 'user';
  if (!isUser) {
    // Assistant replies carry their own frame: a derived title, a copy
    // control and a collapse toggle
    return (
      <Flex justify="flex-start" style={{ margin: `${theme.marginXS}px 0` }}>
        <div
          data-test="chat-message-assistant"
          style={{
            maxWidth: '85%',
            width: '100%',
            borderRadius: theme.borderRadiusLG,
            background: theme.colorFillTertiary,
            overflowWrap: 'break-word',
          }}
        >
          <AssistantMessage content={item.content} fold={fold} />
        </div>
      </Flex>
    );
  }
  return (
    <Flex justify="flex-end" style={{ margin: `${theme.marginXS}px 0` }}>
      <div
        data-test="chat-message-user"
        style={{
          maxWidth: '85%',
          borderRadius: theme.borderRadiusLG,
          padding: `${theme.paddingXS}px ${theme.paddingSM}px`,
          background: theme.colorPrimary,
          color: theme.colorWhite,
          overflowWrap: 'break-word',
        }}
      >
        {item.references?.length ? (
          // Above the question, as they were in the composer when it was
          // asked, and linked so the object is one click away
          <Flex
            wrap
            gap={theme.marginXXS}
            style={{ marginBottom: theme.marginXXS }}
            data-test="chat-message-references"
          >
            {item.references.map(reference => (
              <ReferenceTag
                key={referenceKey(reference)}
                reference={reference}
                linked
                data-test="chat-message-reference"
              />
            ))}
          </Flex>
        ) : null}
        <Typography.Text style={{ color: 'inherit' }}>
          {item.content}
        </Typography.Text>
        {item.attachments?.length ? (
          // Images preview inline, while a text file shows its name only
          // because its contents went to the model, not to the screen
          <Flex
            wrap
            gap={theme.marginXXS}
            style={{ marginTop: theme.marginXXS }}
          >
            {item.attachments.map(file =>
              file.preview ? (
                <Image
                  key={file.name}
                  src={file.preview}
                  alt={file.name}
                  height={120}
                  data-test="chat-message-attachment"
                  style={{
                    borderRadius: theme.borderRadius,
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <Tag
                  key={file.name}
                  icon={<PaperClipOutlined />}
                  style={{ marginInlineEnd: 0 }}
                  data-test="chat-message-attachment"
                >
                  {file.truncated ? t('%s (truncated)', file.name) : file.name}
                </Tag>
              ),
            )}
          </Flex>
        ) : null}
      </div>
    </Flex>
  );
}

interface MessageListProps {
  items: DisplayItem[];
  busy: boolean;
  /** The header's latest instruction to collapse or reopen every panel */
  fold: FoldSignal;
}

/**
 * Scrollable transcript, auto-scrolling on new content unless the user has
 * scrolled up to read earlier messages.
 */
export default function MessageList({ items, busy, fold }: MessageListProps) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (container && nearBottomRef.current) {
      container.scrollTo({ top: container.scrollHeight });
    }
  }, [items, busy]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (container) {
      nearBottomRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        48;
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
      aria-label={t('Conversation')}
      data-test="chat-message-list"
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: `${theme.paddingXS}px ${theme.paddingSM}px`,
      }}
    >
      {items.map(item => {
        switch (item.kind) {
          case 'message':
            return <MessageBubble key={item.id} item={item} fold={fold} />;
          case 'tool':
            return <ToolCallCard key={item.id} item={item} fold={fold} />;
          default:
            return (
              <div
                key={item.id}
                style={{ textAlign: 'center', margin: theme.marginXS }}
              >
                <Typography.Text type="secondary" italic>
                  {item.content}
                </Typography.Text>
                {item.back && (
                  <>
                    {' '}
                    <Typography.Link
                      href={item.back.href}
                      data-test="note-back-link"
                    >
                      {item.back.label}
                    </Typography.Link>
                  </>
                )}
              </div>
            );
        }
      })}
      {busy && (
        <Flex gap={theme.marginXS} align="center">
          <Spin size="small" />
          <Typography.Text type="secondary">{t('Thinking…')}</Typography.Text>
        </Flex>
      )}
    </div>
  );
}
