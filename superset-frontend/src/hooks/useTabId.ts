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
import { nanoid } from 'nanoid';
import {
  StrictBroadcastChannel,
  TabIdChannelMessage,
} from './strictBroadcastChannel';

const TAB_ID_CHANNEL_NAME = 'tab_id_channel';

// Constructed lazily (on first hook use) rather than at module load: importing
// this module must have no side effects, so non-React callers of getTabId (and
// test environments without BroadcastChannel) don't need the native channel.
let channel: StrictBroadcastChannel<TabIdChannelMessage> | undefined;

function getChannel(): StrictBroadcastChannel<TabIdChannelMessage> {
  if (!channel) {
    channel = new BroadcastChannel(TAB_ID_CHANNEL_NAME);
  }
  return channel;
}

function isStorageAvailable() {
  try {
    return window.localStorage && window.sessionStorage;
  } catch (error) {
    return false;
  }
}

// Fallback id for when storage is unavailable: stable for the page lifetime.
let fallbackTabId: string | undefined;

// Listeners notified when this tab's id *changes* after first use — e.g. a
// duplicated tab is reassigned a fresh id on a TAB_ID_DENIED collision. Consumers
// that bake the tab id into long-lived state (the realtime socket registers its
// per-tab channel from it) subscribe to re-sync.
const tabIdChangeListeners = new Set<() => void>();

/**
 * Subscribe to tab-id changes. Returns an unsubscribe function. The listener
 * fires when the id is reassigned (collision resolution), not on first creation.
 */
export function subscribeTabIdChange(listener: () => void): () => void {
  tabIdChangeListeners.add(listener);
  return () => {
    tabIdChangeListeners.delete(listener);
  };
}

function notifyTabIdChange() {
  tabIdChangeListeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      // A listener error must not break tab-id coordination.
    }
  });
}

function createTabId(): string {
  let lastTabId;
  try {
    lastTabId = window.localStorage.getItem('last_tab_id');
  } catch (error) {
    // continue regardless of error
  }
  const newTabId = String(lastTabId ? Number.parseInt(lastTabId, 10) + 1 : 1);
  try {
    window.sessionStorage.setItem('tab_id', newTabId);
    window.localStorage.setItem('last_tab_id', newTabId);
  } catch (error) {
    // continue regardless of error
  }
  return newTabId;
}

/**
 * Return this browser tab's stable id, creating (and persisting) one if absent.
 *
 * Shared by the `useTabId` hook and non-React callers (e.g. the async task
 * middleware, which sends it as `tab_id` on chart-data submit/cancel so the
 * backend can ref-count tabs of a shared task). Both read/write the same
 * `sessionStorage['tab_id']`, so a tab presents one consistent id everywhere,
 * whichever runs first.
 */
export function getTabId(): string {
  if (!isStorageAvailable()) {
    if (!fallbackTabId) {
      fallbackTabId = nanoid();
    }
    return fallbackTabId;
  }
  let stored;
  try {
    stored = window.sessionStorage.getItem('tab_id');
  } catch (error) {
    // continue regardless of error
  }
  return stored || createTabId();
}

export function useTabId() {
  const [tabId, setTabId] = useState<string>();

  useEffect(() => {
    if (!isStorageAvailable()) {
      if (!tabId) {
        setTabId(getTabId());
      }
      return;
    }

    let storedTabId;
    try {
      storedTabId = window.sessionStorage.getItem('tab_id');
    } catch (error) {
      // continue regardless of error
    }
    if (storedTabId) {
      getChannel().postMessage({
        type: 'REQUESTING_TAB_ID',
        tabId: storedTabId,
      });
      setTabId(storedTabId);
    } else {
      setTabId(createTabId());
    }

    getChannel().onmessage = messageEvent => {
      if (messageEvent.data.tabId === tabId) {
        if (messageEvent.data.type === 'REQUESTING_TAB_ID') {
          const message: TabIdChannelMessage = {
            type: 'TAB_ID_DENIED',
            tabId: messageEvent.data.tabId,
          };
          getChannel().postMessage(message);
        } else if (messageEvent.data.type === 'TAB_ID_DENIED') {
          setTabId(createTabId());
          // The id was reassigned; tell consumers that pinned the old one (e.g.
          // the realtime socket's per-tab channel) to re-sync.
          notifyTabIdChange();
        }
      }
    };
  }, [tabId]);

  return tabId;
}
