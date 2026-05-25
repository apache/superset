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
 * @fileoverview Host mount point for the singleton `superset.chatbot`
 * contribution area.
 *
 * The host owns the slot: a fixed bottom-right anchor that persists across all
 * routes, with a managed z-index. The extension owns everything rendered
 * inside it — the collapsed bubble, the expanded panel, all open/close state,
 * animations, and behavior (SIP §3.2 "Component contract").
 *
 * Singleton resolution (which of possibly several registered chatbots renders)
 * is delegated to `getActiveChatbot`. If no chatbot extension is registered,
 * this component renders nothing and the corner stays empty.
 */

import { useState, useEffect } from 'react';
import { css, useTheme } from '@apache-superset/core/theme';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { getActiveChatbot } from 'src/core/chatbot';
import { subscribeToLocation } from 'src/core/views';
import { CHATBOT_LOCATION } from 'src/views/contributions';

const CHATBOT_EDGE_MARGIN = 24;

/**
 * Renders the active chatbot extension into a fixed bottom-right slot.
 *
 * Mounted once at the app root so the bubble persists across routes.
 * Re-resolves when the chatbot registry changes (extension activated or
 * deactivated at runtime via the P1.A lifecycle contract).
 * Renders null when no chatbot extension is registered.
 */
const ChatbotMount = () => {
  const theme = useTheme();
  const [activeChatbot, setActiveChatbot] = useState(getActiveChatbot);

  useEffect(
    () =>
      subscribeToLocation(CHATBOT_LOCATION, () =>
        setActiveChatbot(getActiveChatbot()),
      ),
    [],
  );

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
      <ErrorBoundary>{activeChatbot.provider()}</ErrorBoundary>
    </div>
  );
};

export default ChatbotMount;
