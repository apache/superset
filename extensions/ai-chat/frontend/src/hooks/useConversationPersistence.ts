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
import { Dispatch, useEffect, useState } from 'react';
import { extensions } from '@apache-superset/core';
import {
  ConversationAction,
  ConversationState,
  fromPersisted,
  PersistedConversation,
  toPersisted,
} from '../state/conversation';

const STORAGE_KEY = 'conversation';

/** Extension-scoped storage, absent outside a host that provides it */
function storageLocal() {
  try {
    return extensions.getContext().storage.local;
  } catch {
    return null;
  }
}

/**
 * Restores the conversation once on mount and persists it on change.
 *
 * Persistence is fire-and-forget and size-capped by `toPersisted`. Storage
 * errors are swallowed so a failed write cannot break the conversation, and
 * writes wait for hydration so an empty initial state cannot overwrite a
 * stored conversation.
 */
export function useConversationPersistence(
  state: ConversationState,
  dispatch: Dispatch<ConversationAction>,
): { clear: () => void } {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const storage = storageLocal();
    if (!storage) {
      setHydrated(true);
      return;
    }
    storage
      .get<PersistedConversation>(STORAGE_KEY)
      .then(persisted => {
        if (persisted && persisted.conversationId) {
          dispatch({ type: 'hydrate', state: fromPersisted(persisted) });
        }
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
    // Hydration runs once and dispatch is reducer-stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    storageLocal()
      ?.set(STORAGE_KEY, toPersisted(state))
      .catch(() => undefined);
  }, [state, hydrated]);

  return {
    clear: () => {
      storageLocal()
        ?.remove(STORAGE_KEY)
        .catch(() => undefined);
    },
  };
}
