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
import { type ReactElement, useRef, useSyncExternalStore } from 'react';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { css, useTheme } from '@apache-superset/core/theme';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { store } from 'src/views/store';
import { getChatSnapshot, subscribeToChatState } from 'src/core/chat';

const CHAT_EDGE_MARGIN = 24;
const PANEL_MODE_WIDTH = 400;

/**
 * Wraps a chat provider in a React component so that ErrorBoundary can catch
 * synchronous throws from the provider function itself. Calling `provider()`
 * inline (e.g. `{activeChat.panel()}`) would throw outside React's render
 * boundary and crash the host.
 */
const ChatRenderer = ({ provider }: { provider: () => ReactElement }) =>
  provider();

const ChatMount = () => {
  const theme = useTheme();
  // Notify at most once per registration; a crash can re-render and would
  // otherwise re-toast, while a replacement (new registrationId) deserves a
  // fresh notification if it crashes too.
  const crashNotifiedFor = useRef<number | null>(null);

  // The active chat, the open state, and the display mode are read from one
  // immutable registry snapshot so a render never mixes state from two
  // different store versions (the tearing useSyncExternalStore prevents).
  const {
    open: panelOpen,
    mode,
    active,
  } = useSyncExternalStore(subscribeToChatState, getChatSnapshot);

  if (!active) {
    return null;
  }

  const { registrationId } = active;

  const onProviderError = (error: Error) => {
    // Fault isolation: contain the crash, log it, surface a one-time
    // notification, and leave the slot empty rather than parking a
    // persistent error card.
    logging.error('[chat] provider crashed', error);
    if (crashNotifiedFor.current !== registrationId) {
      crashNotifiedFor.current = registrationId;
      store.dispatch(addDangerToast(t('The chat failed to load.')));
    }
  };

  if (mode === 'panel') {
    // Panel mode hides the trigger and docks the panel to the right edge.
    // Interim approximation of the "layout slot between header and footer"
    // from the chat API contract — the dock overlays the page until the host
    // grows a real layout slot and resizer chrome.
    if (!panelOpen) {
      return null;
    }
    return (
      <div
        data-test="chat-mount"
        css={css`
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: ${PANEL_MODE_WIDTH}px;
          background: ${theme.colorBgContainer};
          box-shadow: ${theme.boxShadow};
          /* Above dashboard content and the toast layer, below modal dialogs. */
          z-index: ${theme.zIndexPopupBase + 2};
        `}
      >
        <ErrorBoundary
          key={registrationId}
          showMessage={false}
          onError={onProviderError}
        >
          <ChatRenderer provider={active.panel} />
        </ErrorBoundary>
      </div>
    );
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
        Each provider gets its own boundary so a crashing panel cannot take
        the trigger down with it (the trigger is the user's only way back).
        Keyed by registrationId: Superset's ErrorBoundary latches its error
        state, so a takeover, fallback, or same-id re-registration must
        remount the boundary to recover.
      */}
      {panelOpen && (
        <ErrorBoundary
          key={`panel-${registrationId}`}
          showMessage={false}
          onError={onProviderError}
        >
          <ChatRenderer provider={active.panel} />
        </ErrorBoundary>
      )}
      <ErrorBoundary
        key={`trigger-${registrationId}`}
        showMessage={false}
        onError={onProviderError}
      >
        <ChatRenderer provider={active.trigger} />
      </ErrorBoundary>
    </div>
  );
};

export default ChatMount;
