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
import React, { useEffect, useRef, useState } from 'react';
import { Button, Collapse, Flex, Tooltip } from 'antd';
import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import { theme, translation } from '@apache-superset/core';
import {
  deriveMessageTitle,
  isCollapsible,
  messageBody,
} from '../utils/messageTitle';
import type { FoldSignal } from '../types';
import Markdown from './Markdown';

const { t } = translation;
const { useTheme } = theme;

/** Sole panel key, since a reply is one section */
const MESSAGE_KEY = 'message';

/** How long the copy button acknowledges a successful copy */
const COPIED_FEEDBACK_MS = 1500;

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const label = copied ? t('Copied') : t('Copy message');
  return (
    <Tooltip title={label}>
      <Button
        size="small"
        type="text"
        icon={copied ? <CheckOutlined /> : <CopyOutlined />}
        aria-label={label}
        data-test="chat-message-copy"
        onClick={event => {
          // The button lives in the panel header, so without this the click
          // also collapses the message
          event.stopPropagation();
          navigator.clipboard
            ?.writeText(content)
            .then(() => setCopied(true))
            // Clipboard access can be denied, and the message stays readable
            // either way, so there is nothing to report
            .catch(() => undefined);
        }}
      />
    </Tooltip>
  );
}

/**
 * One assistant reply, collapsible under a title derived from its content.
 * Long answers otherwise push the conversation out of view, so a reply folds
 * down to its title while staying copyable.
 */
export default function AssistantMessage({
  content,
  fold,
}: {
  content: string;
  fold: FoldSignal;
}) {
  const theme = useTheme();
  const [activeKeys, setActiveKeys] = useState<string[]>([MESSAGE_KEY]);
  // Replies open expanded, including one arriving after a collapse-all, since
  // only instructions issued while this reply is on screen apply to it
  const seenFold = useRef(fold.seq);

  useEffect(() => {
    if (fold.seq === seenFold.current) return;
    seenFold.current = fold.seq;
    setActiveKeys(fold.collapsed ? [] : [MESSAGE_KEY]);
  }, [fold]);

  if (!isCollapsible(content)) {
    // A one-line reply is its own title, so collapsing it would repeat it
    return (
      <Flex
        align="flex-start"
        gap={theme.marginXXS}
        style={{ padding: `${theme.paddingXS}px ${theme.paddingSM}px` }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <Markdown source={content} />
        </div>
        <CopyButton content={content} />
      </Flex>
    );
  }

  return (
    <Collapse
      ghost
      activeKey={activeKeys}
      onChange={keys => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
      expandIconPlacement="end"
      items={[
        {
          key: MESSAGE_KEY,
          label: deriveMessageTitle(content),
          extra: <CopyButton content={content} />,
          children: <Markdown source={messageBody(content)} />,
        },
      ]}
    />
  );
}
