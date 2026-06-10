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
 * @fileoverview Host-internal resolver for the exclusive `core.chatbot`
 * contribution area.
 *
 * `core.chatbot` is a singleton contribution area: multiple chatbot
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
 * Selection policy:
 *  - If no chatbot is registered, returns `undefined` — the corner stays empty.
 *  - If `adminSelectedId` matches a registered chatbot, that one wins.
 *  - Otherwise the first-registered chatbot is used as a fallback.
 *    The active chatbot pin is set only via the backend DB; when no pin is set
 *    (active_chatbot_id is null), the fallback is the first-registered chatbot.
 *
 * @param adminSelectedId The id stored in the DB "Default chatbot" setting, if any.
 * @returns The active chatbot's id and provider, or `undefined` if none.
 */
export const getActiveChatbot = (
  adminSelectedId?: string | null,
): ActiveChatbot | undefined => {
  const registeredIds = getRegisteredViewIds(CHATBOT_LOCATION);
  if (registeredIds.length === 0) {
    return undefined;
  }

  // When the DB pin names a registered candidate, use it; otherwise fall back
  // to the first registered chatbot in registration order.
  // `getRegisteredViewIds` and `getViewProvider` read the same synchronous
  // registry maps, so a candidate id always has a live provider; the final
  // guard is cheap defensiveness, not a fallback path.
  const selectedId =
    adminSelectedId && registeredIds.includes(adminSelectedId)
      ? adminSelectedId
      : registeredIds[0];

  const provider = getViewProvider(CHATBOT_LOCATION, selectedId);
  return provider ? { id: selectedId, provider } : undefined;
};
