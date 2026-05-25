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
 * @fileoverview Host-internal resolver for the exclusive `superset.chatbot`
 * contribution area.
 *
 * `superset.chatbot` is a singleton contribution area: multiple chatbot
 * extensions may register a view there, but the host renders exactly one.
 * This module owns the host-side selection policy.
 *
 * This is host-internal infrastructure — it is NOT part of the public
 * `@apache-superset/core` API. Extensions register via the public
 * `views.registerView()`; only the host resolves which one is active.
 */

import { ReactElement } from 'react';
import { CHATBOT_LOCATION } from 'src/views/contributions';
import { getRegisteredViewIds, getViewProvider } from 'src/core/views';

/**
 * The resolved active chatbot: a view id paired with its renderable provider.
 */
export interface ActiveChatbot {
  /** The registered view id of the selected chatbot. */
  id: string;
  /** The provider that renders the chatbot's React element. */
  provider: () => ReactElement;
}

/**
 * Resolves which single chatbot extension is currently active.
 *
 * Selection policy (P1):
 *  - If no chatbot is registered, returns `undefined` — the corner stays empty.
 *  - If one or more chatbots are registered, the first one to register wins.
 *
 * `Set` preserves insertion order, so "first to register" is deterministic.
 *
 * This is the P1 fallback policy. P2 introduces an admin "Default chatbot"
 * setting (SIP §4 option (c)); when that lands, the admin-selected id takes
 * precedence here and this first-to-register behavior remains only as the
 * fallback used when no admin setting is configured.
 *
 * @returns The active chatbot's id and provider, or `undefined` if none.
 */
export const getActiveChatbot = (): ActiveChatbot | undefined => {
  const registeredIds = getRegisteredViewIds(CHATBOT_LOCATION);
  if (registeredIds.length === 0) {
    return undefined;
  }

  // Deterministic first-to-register fallback. P2 will consult the admin
  // "Default chatbot" setting before this point.
  const [selectedId] = registeredIds;
  const provider = getViewProvider(CHATBOT_LOCATION, selectedId);
  if (!provider) {
    return undefined;
  }

  return { id: selectedId, provider };
};
