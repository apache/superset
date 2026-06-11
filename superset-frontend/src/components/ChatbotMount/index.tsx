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
import {
  type ReactElement,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { t } from '@apache-superset/core/translation';
import { logging } from '@apache-superset/core/utils';
import { css, useTheme } from '@apache-superset/core/theme';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { store } from 'src/views/store';
import { getActiveChatbot } from 'src/core/chatbot';
import { subscribeToRegistry, getRegistryVersion } from 'src/core/views';

const CHATBOT_EDGE_MARGIN = 24;

/**
 * Wraps the chatbot provider in a React component so that ErrorBoundary can
 * catch synchronous throws from the provider function itself. Calling
 * `provider()` inline (e.g. `{activeChatbot.provider()}`) would throw outside
 * React's render boundary and crash the host.
 */
const ChatbotRenderer = ({ provider }: { provider: () => ReactElement }) =>
  provider();

const ChatbotMount = () => {
  const theme = useTheme();
  // Notify once per mount; a crash can re-render and would otherwise re-toast.
  const crashNotified = useRef(false);

  // The active chatbot is a function of the view registry alone: the
  // most-recently-registered chatbot wins. Read via useSyncExternalStore so it
  // re-resolves whenever a chatbot extension registers or disposes.
  const registryVersion = useSyncExternalStore(
    subscribeToRegistry,
    getRegistryVersion,
  );

  const activeChatbot = useMemo(() => getActiveChatbot(), [registryVersion]);

  if (!activeChatbot) {
    return null;
  }

  return (
    <div
      data-test="chatbot-mount"
      css={css`
        position: fixed;
        right: ${CHATBOT_EDGE_MARGIN}px;
        bottom: ${CHATBOT_EDGE_MARGIN}px;
        /* Above dashboard content and the toast layer, below modal dialogs. */
        z-index: ${theme.zIndexPopupBase + 2};
      `}
    >
      <ErrorBoundary
        showMessage={false}
        onError={(error: Error) => {
          // Fault isolation: contain the crash, log it, surface a one-time
          // notification, and leave the corner empty rather than parking a
          // persistent error card.
          logging.error('[chatbot] provider crashed', error);
          if (!crashNotified.current) {
            crashNotified.current = true;
            store.dispatch(addDangerToast(t('The chatbot failed to load.')));
          }
        }}
      >
        <ChatbotRenderer provider={activeChatbot.provider} />
      </ErrorBoundary>
    </div>
  );
};

export default ChatbotMount;
