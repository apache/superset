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
import { useEffect, useState } from 'react';
import { css, useTheme } from '@apache-superset/core/theme';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { getActiveChatbot } from 'src/core/chatbot';
import { subscribeToLocation } from 'src/core/views';
import { CHATBOT_LOCATION } from 'src/views/contributions';

const CHATBOT_EDGE_MARGIN = 24;

const ChatbotMount = () => {
  const theme = useTheme();
  const [activeChatbot, setActiveChatbot] = useState(() => getActiveChatbot());

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
