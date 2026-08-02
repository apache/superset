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
import React, { useRef, useState } from 'react';
import {
  Badge,
  Button,
  Flex,
  Image,
  Input,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CloseCircleFilled,
  EyeOutlined,
  PaperClipOutlined,
  PlusOutlined,
  SendOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { InputRef } from 'antd';
import { theme, translation } from '@apache-superset/core';
import {
  ATTACHMENT_ACCEPT,
  Attachment,
  MAX_ATTACHMENTS,
} from '../utils/attachments';
import { droppedText, referenceKey } from '../utils/entityRef';
import type { EntityReferences } from '../hooks/useEntityReferences';
import type { StagedFiles } from '../hooks/useStagedFiles';
import ReferenceTag from './ReferenceTag';

const { t } = translation;
const { useTheme } = theme;

interface ChatInputProps {
  disabled: boolean;
  busy: boolean;
  onSend: (message: string, attachments: Attachment[]) => void;
  onCancel: () => void;
  /** Superset objects dropped in as lasting context. */
  entities: EntityReferences;
  /** Files picked for the next message. */
  staged: StagedFiles;
  autoFocus?: boolean;
}

/**
 * Multiline input where Enter sends and Shift+Enter inserts a newline. The
 * send button becomes a cancel button while a request is in flight.
 *
 * Only the draft text is the composer's own: staged files and dropped
 * dashboards, charts and datasets belong to the conversation, so the panel
 * holds them and decides when they go away.
 */
export default function ChatInput({
  disabled,
  busy,
  onSend,
  onCancel,
  entities,
  staged,
  autoFocus,
}: ChatInputProps) {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<InputRef>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = value.trim();
    if ((trimmed || staged.files.length) && !busy && !disabled) {
      onSend(trimmed, staged.files);
      setValue('');
      staged.clear();
      inputRef.current?.focus();
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    setDragging(false);
    const files = event.dataTransfer?.files;
    if (files?.length) {
      event.preventDefault();
      staged.add(files);
      return;
    }
    const text = droppedText(event.dataTransfer);
    if (!text) return;
    // Only claim the drop once it names something, so a link that is not a
    // Superset object still behaves like an ordinary link.
    if (entities.add(text)) event.preventDefault();
  };

  return (
    <Flex
      vertical
      gap={theme.marginXXS}
      onDragOver={event => {
        // Without this the browser refuses the drop outright.
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={event => {
        // Moving between children fires dragleave on the one being left, so
        // the highlight only clears when the pointer leaves the composer.
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setDragging(false);
        }
      }}
      onDrop={handleDrop}
      data-test="chat-composer"
      style={{
        padding: theme.paddingSM,
        outline: dragging ? `2px dashed ${theme.colorPrimary}` : 'none',
        outlineOffset: -2,
      }}
    >
      {(entities.references.length > 0 || dragging) && (
        <Flex
          wrap
          gap={theme.marginXXS}
          align="center"
          data-test="chat-references"
        >
          {entities.references.map(reference => (
            <ReferenceTag
              key={referenceKey(reference)}
              reference={reference}
              onClose={() => entities.remove(referenceKey(reference))}
              data-test="chat-reference"
            />
          ))}
          {dragging && entities.references.length === 0 && (
            <Typography.Text type="secondary">
              {t('Drop a dashboard, chart or dataset to add it as context')}
            </Typography.Text>
          )}
        </Flex>
      )}
      {entities.error && (
        <Typography.Text type="danger" data-test="chat-reference-error">
          {entities.error}
        </Typography.Text>
      )}
      {staged.files.length > 0 && (
        <Flex
          wrap
          gap={theme.marginXXS}
          align="center"
          data-test="chat-attachments"
        >
          {staged.files.map(file =>
            file.kind === 'image' ? (
              <Badge
                key={file.id}
                count={
                  <CloseCircleFilled
                    onClick={event => {
                      // The badge sits on the thumbnail, so without this the
                      // click also opens the preview being removed
                      event.stopPropagation();
                      staged.remove(file.id);
                    }}
                    role="button"
                    aria-label={t('Remove %s', file.name)}
                    data-test="chat-attachment-remove"
                    style={{
                      color: theme.colorTextTertiary,
                      cursor: 'pointer',
                    }}
                  />
                }
              >
                <Image
                  src={file.preview}
                  alt={file.name}
                  title={file.name}
                  height={48}
                  width={96}
                  // Full size before sending, since a staged screenshot is
                  // too small to check as a thumbnail
                  preview={{ mask: <EyeOutlined /> }}
                  data-test="chat-attachment"
                  style={{
                    objectFit: 'cover',
                    borderRadius: theme.borderRadius,
                    border: `1px solid ${theme.colorBorderSecondary}`,
                  }}
                />
              </Badge>
            ) : (
              <Tag
                key={file.id}
                icon={<PaperClipOutlined />}
                closable
                onClose={() => staged.remove(file.id)}
                data-test="chat-attachment"
              >
                {file.truncated ? t('%s (truncated)', file.name) : file.name}
              </Tag>
            ),
          )}
        </Flex>
      )}
      {staged.error && (
        <Typography.Text type="danger" data-test="chat-attachment-error">
          {staged.error}
        </Typography.Text>
      )}
      <Flex
        gap={theme.marginXS}
        // Keep the buttons on the first row's baseline as the textarea grows
        // toward its 5-row maximum
        align="flex-end"
      >
        <Tooltip title={t('Attach files')}>
          <Button
            icon={<PlusOutlined />}
            onClick={() => fileRef.current?.click()}
            disabled={disabled || staged.files.length >= MAX_ATTACHMENTS}
            aria-label={t('Attach files')}
            data-test="chat-attach"
          />
        </Tooltip>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          hidden
          onChange={event => {
            staged.add(event.target.files);
            // Let the same file be picked again after being removed
            event.target.value = '';
          }}
          aria-hidden
          data-test="chat-attach-input"
        />
        <Input.TextArea
          ref={inputRef}
          autoFocus={autoFocus}
          value={value}
          disabled={disabled}
          onChange={event => setValue(event.target.value)}
          onPressEnter={event => {
            if (!event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          autoSize={{ minRows: 1, maxRows: 5 }}
          placeholder={t('Ask the assistant…')}
          aria-label={t('Chat message')}
          data-test="chat-input"
        />
        {busy ? (
          <Tooltip title={t('Cancel request')}>
            <Button
              icon={<StopOutlined />}
              onClick={onCancel}
              aria-label={t('Cancel request')}
              data-test="chat-cancel"
            />
          </Tooltip>
        ) : (
          <Tooltip title={t('Send message')}>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={submit}
              disabled={disabled || !(value.trim() || staged.files.length)}
              aria-label={t('Send message')}
              data-test="chat-send"
            />
          </Tooltip>
        )}
      </Flex>
    </Flex>
  );
}
