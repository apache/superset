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
import shortid from 'shortid';
import { BroadcastChannel } from 'broadcast-channel';

interface TabIdChannelMessage {
  type: 'REQUESTING_TAB_ID' | 'TAB_ID_DENIED';
  tabId: string;
}

// TODO: We are using broadcast-channel to support Safari.
// The native BroadcastChannel API will be supported in Safari version 15.4.
// After that, we should remove this dependency and use the native API.
const channel = new BroadcastChannel<TabIdChannelMessage>('tab_id_channel');

export function useTabId() {
  const [tabId, setTabId] = useState<string>();

  function isStorageAvailable() {
    try {
      return window.localStorage && window.sessionStorage;
    } catch (error) {
      return false;
    }
  }
  useEffect(() => {
    if (!isStorageAvailable()) {
      if (!tabId) {
        setTabId(shortid.generate());
      }
      return;
    }

    const updateTabId = () => {
      let lastTabId;
      try {
        lastTabId = window.localStorage.getItem('last_tab_id');
      } catch (error) {
        // continue regardless of error
      }
      const newTabId = String(
        lastTabId ? Number.parseInt(lastTabId, 10) + 1 : 1,
      );
      try {
        window.sessionStorage.setItem('tab_id', newTabId);
        window.localStorage.setItem('last_tab_id', newTabId);
      } catch (error) {
        // continue regardless of error
      }
      setTabId(newTabId);
    };
    let storedTabId;
    try {
      storedTabId = window.sessionStorage.getItem('tab_id');
    } catch (error) {
      // continue regardless of error
    }
    if (storedTabId) {
      channel.postMessage({
        type: 'REQUESTING_TAB_ID',
        tabId: storedTabId,
      });
      setTabId(storedTabId);
    } else {
      updateTabId();
    }

    channel.onmessage = messageEvent => {
      if (messageEvent.tabId === tabId) {
        if (messageEvent.type === 'REQUESTING_TAB_ID') {
          const message: TabIdChannelMessage = {
            type: 'TAB_ID_DENIED',
            tabId: messageEvent.tabId,
          };
          channel.postMessage(message);
        } else if (messageEvent.type === 'TAB_ID_DENIED') {
          updateTabId();
        }
      }
    };
  }, [tabId]);

  return tabId;
}
