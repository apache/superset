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
import { useEffect, useRef } from 'react';

const OAUTH_CHANNEL_NAME = 'oauth';
const OAUTH_STORAGE_EVENT_KEY = 'oauth2_auth_complete';

/** Listen for a matching OAuth completion, once per connection attempt. */
export default function useOAuth2Completion(
  tabId: string | undefined,
  onComplete: () => void | boolean,
) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const retryCompletionRef = useRef<() => void>();

  useEffect(() => {
    if (!tabId) return undefined;
    let pending = false;
    let handled = false;
    const retryCompletion = () => {
      if (pending && !handled && onCompleteRef.current() !== false) {
        handled = true;
        pending = false;
      }
    };
    retryCompletionRef.current = retryCompletion;
    const handleCompletion = (message: unknown) => {
      if (
        typeof message !== 'object' ||
        message === null ||
        !('tabId' in message) ||
        message.tabId !== tabId ||
        handled
      ) {
        return;
      }
      pending = true;
      retryCompletion();
    };
    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(OAUTH_CHANNEL_NAME)
        : null;
    if (channel) {
      channel.onmessage = event => handleCompletion(event.data);
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== OAUTH_STORAGE_EVENT_KEY || !event.newValue) return;
      try {
        handleCompletion(JSON.parse(event.newValue));
      } catch {
        // Ignore malformed notifications from other tabs.
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      retryCompletionRef.current = undefined;
      window.removeEventListener('storage', handleStorage);
      channel?.close();
    };
  }, [tabId]);

  // A query can finish loading after its OAuth notification arrives.
  useEffect(() => {
    retryCompletionRef.current?.();
  });
}
