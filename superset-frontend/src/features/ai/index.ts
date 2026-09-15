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
 * @fileoverview Registers the AI assistant as a chat provider.
 *
 * The chat host owns mounting, the floating-versus-docked layout and the panel
 * width, so all this contributes is a trigger, a panel and a descriptor.
 * Importing this module registers the provider; the host is itself gated on the
 * extensions flag and an authenticated user, so registration is only gated here
 * on the assistant being switched on.
 */

import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { chat } from 'src/core/chat';
import { AiAssistantPanel } from './AiAssistantPanel';
import { AiAssistantTrigger } from './AiAssistantTrigger';

export const AI_CHAT_ID = 'superset.ai-assistant';

type ChatRegistration = ReturnType<typeof chat.registerChat>;

let registration: ChatRegistration | undefined;

/**
 * Whether this page is a chrome-less render rather than someone using Superset.
 *
 * Covers both routes that produce one: `?standalone=` for a dashboard or chart
 * embedded in an iframe or captured for a report, and the `/embedded/` route used
 * by the embedding SDK. Neither is a place for an assistant — a screenshot would
 * capture the trigger, and an embedded dashboard on someone else's site should not
 * offer a chat panel at all.
 *
 * Read from the URL rather than from Redux so it holds for every page type,
 * including those whose reducers are not registered.
 */
export function isChromelessRender(): boolean {
  try {
    const { search, pathname } = window.location;
    const standalone = new URLSearchParams(search).get('standalone');
    // Any non-zero value hides chrome; `0` and an absent param do not.
    if (standalone && standalone !== '0') {
      return true;
    }
    return pathname.includes('/embedded/');
  } catch {
    // Without a location there is no page to decorate either way.
    return false;
  }
}

/**
 * Registers the assistant, unless the feature is off, this is a chrome-less
 * render, or it is already registered. Returns the Disposable that unregisters
 * it.
 */
export function registerAiAssistant(): ChatRegistration | undefined {
  if (
    registration ||
    !isFeatureEnabled(FeatureFlag.AiAssistant) ||
    isChromelessRender()
  ) {
    return registration;
  }
  registration = chat.registerChat(
    {
      id: AI_CHAT_ID,
      name: t('AI assistant'),
      description: t('Ask questions about your data in natural language.'),
    },
    AiAssistantTrigger,
    AiAssistantPanel,
  );
  return registration;
}

/** Releases the registration. Exposed for tests and for hot reloading. */
export function unregisterAiAssistant(): void {
  registration?.dispose();
  registration = undefined;
}

registerAiAssistant();
