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
 * @fileoverview The collapsed entry point for the assistant.
 *
 * Placement is the host's business — this only decides what the control looks
 * like and that it toggles the panel.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { t } from '@apache-superset/core/translation';
import { Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { chat } from 'src/core/chat';

/**
 * Tracks the host's open state. The host also opens and closes the panel of its
 * own accord, so the state is read from it rather than mirrored locally.
 */
const useChatOpen = (): boolean =>
  useSyncExternalStore(
    useCallback((onChange: () => void) => {
      const opened = chat.onDidOpen(onChange);
      const closed = chat.onDidClose(onChange);
      return () => {
        opened.dispose();
        closed.dispose();
      };
    }, []),
    chat.isOpen,
  );

export const AiAssistantTrigger = () => {
  const open = useChatOpen();
  const label = open ? t('Hide the AI assistant') : t('Ask the AI assistant');

  return (
    <Button
      buttonStyle="primary"
      shape="circle"
      data-test="ai-assistant-trigger"
      aria-label={label}
      aria-expanded={open}
      tooltip={label}
      icon={
        open ? (
          <Icons.CloseOutlined iconSize="l" />
        ) : (
          <Icons.CommentOutlined iconSize="l" />
        )
      }
      onClick={() => (open ? chat.close() : chat.open())}
    />
  );
};

export default AiAssistantTrigger;
