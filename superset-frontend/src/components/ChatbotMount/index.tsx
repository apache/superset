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
import { useState, useEffect, useCallback } from 'react';
import { ReactElement } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/theme';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { getActiveChatbot } from 'src/core/chatbot';
import { subscribeToLocation } from 'src/core/views';
import { subscribeToExtensionSettings } from 'src/core/extensions';
import { CHATBOT_LOCATION } from 'src/views/contributions';

const CHATBOT_EDGE_MARGIN = 24;

type ActiveChatbot = { provider: () => ReactElement };

// Renders the provider as a component so ErrorBoundary catches provider-level throws.
const ChatbotRenderer = ({ provider }: { provider: () => ReactElement }) =>
  provider();

const ChatbotMount = () => {
  const theme = useTheme();
  const [adminSelectedId, setAdminSelectedId] = useState<string | null>(null);
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
  // null = settings not yet loaded; don't render anything until settings arrive.
  const [activeChatbot, setActiveChatbot] = useState<ActiveChatbot | null>(
    null,
  );

  const fetchSettings = useCallback(() => {
    let cancelled = false;
    SupersetClient.get({ endpoint: '/api/v1/extensions/settings' })
      .then(({ json }) => {
        if (cancelled) return;
        const id = json.result?.active_chatbot_id ?? null;
        const enabled: Record<string, boolean> = json.result?.enabled ?? {};
        setAdminSelectedId(id);
        setEnabledMap(enabled);
        setActiveChatbot(getActiveChatbot(id, enabled));
      })
      .catch(() => {
        // Settings fetch failure is non-fatal — fall back to first-to-register.
        setActiveChatbot(getActiveChatbot(null, {}));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => fetchSettings(), [fetchSettings]);

  useEffect(() => subscribeToExtensionSettings(fetchSettings), [fetchSettings]);

  useEffect(
    () =>
      subscribeToLocation(CHATBOT_LOCATION, () =>
        setActiveChatbot(getActiveChatbot(adminSelectedId, enabledMap)),
      ),
    [adminSelectedId, enabledMap],
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
      <ErrorBoundary>
        <ChatbotRenderer provider={activeChatbot.provider} />
      </ErrorBoundary>
    </div>
  );
};

export default ChatbotMount;
