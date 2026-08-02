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
  BarChartOutlined,
  CloseCircleFilled,
  DatabaseOutlined,
  DashboardOutlined,
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
  readAttachment,
} from '../utils/attachments';
import { droppedText, referenceKey } from '../utils/entityRef';
import type { EntityReferences } from '../hooks/useEntityReferences';
import type { ResourceContext } from '../types';

const { t } = translation;
const { useTheme } = theme;

const REFERENCE_ICON: Record<ResourceContext['kind'], React.ReactNode> = {
  dashboard: <DashboardOutlined />,
  chart: <BarChartOutlined />,
  dataset: <DatabaseOutlined />,
};

function referenceLabel(reference: ResourceContext): string {
  const kind: Record<ResourceContext['kind'], string> = {
    dashboard: t('Dashboard'),
    chart: t('Chart'),
    dataset: t('Dataset'),
  };
  // Until the name resolves, the id is what identifies it.
  return reference.name || `${kind[reference.kind]} ${reference.id_or_slug}`;
}

interface ChatInputProps {
  disabled: boolean;
  busy: boolean;
  onSend: (message: string, attachments: Attachment[]) => void;
  onCancel: () => void;
  /** Superset objects dropped in as lasting context. */
  entities: EntityReferences;
  autoFocus?: boolean;
}

/**
 * Multiline input where Enter sends and Shift+Enter inserts a newline. The
 * send button becomes a cancel button while a request is in flight. Picked
 * files are read here and travel with the next message, so they clear once
 * it is sent, while dropped dashboards, charts and datasets stay attached
 * until removed.
 */
export default function ChatInput({
  disabled,
  busy,
  onSend,
  onCancel,
  entities,
  autoFocus,
}: ChatInputProps) {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<InputRef>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = value.trim();
    if ((trimmed || attachments.length) && !busy && !disabled) {
      onSend(trimmed, attachments);
      setValue('');
      setAttachments([]);
      setError(null);
      inputRef.current?.focus();
    }
  };

  const remove = (id: string) =>
    setAttachments(current => current.filter(entry => entry.id !== id));

  const addFiles = async (picked: FileList | null) => {
    if (!picked?.length) return;
    const overflow =
      picked.length > MAX_ATTACHMENTS - attachments.length
        ? t('You can attach up to %s files per message.', MAX_ATTACHMENTS)
        : null;
    const results = await Promise.allSettled(
      Array.from(picked).slice(0, MAX_ATTACHMENTS).map(readAttachment),
    );
    const added = results
      .filter(
        (result): result is PromiseFulfilledResult<Attachment> =>
          result.status === 'fulfilled',
      )
      .map(result => result.value);
    const rejected = results.find(result => result.status === 'rejected') as
      PromiseRejectedResult | undefined;
    // Reading a file takes long enough for a second pick to start before this
    // one lands, so the limit applies to the state being replaced rather than
    // to the count captured when the picker opened. Files beyond it are
    // dropped instead of replacing what is already staged.
    setAttachments(current => {
      const room = MAX_ATTACHMENTS - current.length;
      return room > 0 ? [...current, ...added.slice(0, room)] : current;
    });
    setError(rejected ? String(rejected.reason.message) : overflow);
  };

  const handleDrop = (event: React.DragEvent) => {
    setDragging(false);
    const files = event.dataTransfer?.files;
    if (files?.length) {
      event.preventDefault();
      addFiles(files);
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
            <Tag
              key={referenceKey(reference)}
              icon={REFERENCE_ICON[reference.kind]}
              closable
              onClose={() => entities.remove(referenceKey(reference))}
              data-test="chat-reference"
              title={referenceLabel(reference)}
              // Same tokens as the host's secondary button, matching the
              // scope tag in the header. Set through `style` rather than
              // Tag's `color` prop, which pairs a custom background with
              // white text.
              style={{
                color: theme.buttonSecondaryColor || theme.colorPrimary,
                background: theme.buttonSecondaryBg || theme.colorPrimaryBg,
                borderColor: theme.buttonSecondaryBorderColor || 'transparent',
                maxWidth: 200,
                overflow: 'hidden',
              }}
            >
              {referenceLabel(reference)}
            </Tag>
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
      {attachments.length > 0 && (
        <Flex
          wrap
          gap={theme.marginXXS}
          align="center"
          data-test="chat-attachments"
        >
          {attachments.map(file =>
            file.kind === 'image' ? (
              <Badge
                key={file.id}
                count={
                  <CloseCircleFilled
                    onClick={event => {
                      // The badge sits on the thumbnail, so without this the
                      // click also opens the preview being removed
                      event.stopPropagation();
                      remove(file.id);
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
                onClose={() => remove(file.id)}
                data-test="chat-attachment"
              >
                {file.truncated ? t('%s (truncated)', file.name) : file.name}
              </Tag>
            ),
          )}
        </Flex>
      )}
      {error && (
        <Typography.Text type="danger" data-test="chat-attachment-error">
          {error}
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
            disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
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
            addFiles(event.target.files);
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
              disabled={disabled || !(value.trim() || attachments.length)}
              aria-label={t('Send message')}
              data-test="chat-send"
            />
          </Tooltip>
        )}
      </Flex>
    </Flex>
  );
}
