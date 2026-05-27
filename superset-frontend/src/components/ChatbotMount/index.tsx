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
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/theme';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { getActiveChatbot } from 'src/core/chatbot';
import { subscribeToRegistry, getRegistryVersion } from 'src/core/views';

const CHATBOT_EDGE_MARGIN = 24;

const ChatbotMount = () => {
  const theme = useTheme();
  // undefined = settings not yet loaded; don't render anything until settings arrive.
  const [adminSelectedId, setAdminSelectedId] = useState<
    string | null | undefined
  >(undefined);
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    SupersetClient.get({ endpoint: '/api/v1/extensions/settings' })
      .then(({ json }) => {
        if (cancelled) return;
        const id = json.result?.active_chatbot_id ?? null;
        const enabled: Record<string, boolean> = json.result?.enabled ?? {};
        setAdminSelectedId(id);
        setEnabledMap(enabled);
      })
      .catch(() => {
        // Settings fetch failure is non-fatal — fall back to first-to-register.
        setAdminSelectedId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const registryVersion = useSyncExternalStore(
    subscribeToRegistry,
    getRegistryVersion,
  );

  const activeChatbot = useMemo(
    () =>
      adminSelectedId === undefined
        ? null
        : getActiveChatbot(adminSelectedId, enabledMap),
    [adminSelectedId, enabledMap, registryVersion],
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
