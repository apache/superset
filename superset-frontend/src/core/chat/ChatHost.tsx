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
import { type ComponentType, useRef } from 'react';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { css, useTheme } from '@apache-superset/core/theme';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { store } from 'src/views/store';
import { useChat } from '.';

const CHAT_EDGE_MARGIN = 24;

/**
 * Returns an onError handler that shows a toast on crash, once per chat id.
 */
function useCrashNotifier(chatId: string | undefined) {
  const notifiedFor = useRef<string | undefined>(undefined);
  return (error: Error) => {
    if (!chatId) return;
    logging.error('[chat] provider crashed', error);
    if (notifiedFor.current !== chatId) {
      notifiedFor.current = chatId;
      store.dispatch(addDangerToast(t('The chat failed to load.')));
    }
  };
}

/**
 * Wraps a component in an ErrorBoundary, keyed by chat id so the boundary
 * resets when a different chat takes over.
 */
const ChatBoundary = ({
  component: Component,
  onError,
}: {
  component: ComponentType;
  onError: (error: Error) => void;
}) => (
  <ErrorBoundary showMessage={false} onError={onError}>
    <Component />
  </ErrorBoundary>
);

/**
 * Renders the chat panel content in panel mode. Fills its container height.
 */
export const ChatPanelHost = () => {
  const { chat, panel } = useChat();
  const onError = useCrashNotifier(chat?.id);

  if (!chat || !panel) {
    return null;
  }

  return (
    <div
      data-test="chat-mount"
      css={css`
        display: flex;
        flex-direction: column;
        height: 100%;
      `}
    >
      <ChatBoundary key={chat.id} component={panel} onError={onError} />
    </div>
  );
};

/**
 * Renders the chat trigger and, when the panel is open in floating mode, the
 * floating panel overlay. The trigger is always visible when a chat is
 * registered; the panel overlay is suppressed in panel mode.
 */
export const ChatFloatingHost = () => {
  const theme = useTheme();
  const { open: panelOpen, mode, chat, trigger, panel } = useChat();
  const onError = useCrashNotifier(chat?.id);

  if (!chat || !trigger || !panel) {
    return null;
  }

  return (
    <div
      data-test="chat-mount"
      css={css`
        position: fixed;
        right: ${CHAT_EDGE_MARGIN}px;
        bottom: ${CHAT_EDGE_MARGIN}px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: ${theme.sizeUnit * 2}px;
        /* Above dashboard content and the toast layer, below modal dialogs. */
        z-index: ${theme.zIndexPopupBase + 2};
      `}
    >
      {/*
        Separate boundaries so a crashing panel cannot take the trigger down
        with it — the trigger is the user's only way back.
      */}
      {panelOpen && mode !== 'panel' && (
        <ChatBoundary
          key={`panel-${chat.id}`}
          component={panel}
          onError={onError}
        />
      )}
      <ChatBoundary
        key={`trigger-${chat.id}`}
        component={trigger}
        onError={onError}
      />
    </div>
  );
};
