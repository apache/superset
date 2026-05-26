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
import React from 'react';
import { views } from '@apache-superset/core';
import { ReferenceChatbot } from './ReferenceChatbot';
import { registerChatbotCommands } from './commands';
import { abortAllActiveControllers } from './streaming/registry';
import { resetState } from './state';

export const VIEW_ID = 'apache-superset.reference-chatbot';
export const CHATBOT_LOCATION = 'superset.chatbot';

interface DisposableLike {
  dispose(): void;
}

/**
 * Registers the reference chatbot and returns a single disposable that
 * tears down everything it created. Idempotent across activate/dispose cycles.
 *
 * Cleanup order matters: stop in-flight streams first so listeners do not
 * receive late tokens, then unregister commands (so user clicks during teardown
 * become no-ops), then unregister the view (so the host's ChatbotMount unmounts
 * the React tree), and finally reset module state.
 *
 * Returns a plain `{ dispose }` object rather than constructing a Disposable
 * from the SDK — the SDK class is host-injected and only reliably available
 * via window.superset at runtime, while plain disposable-likes work in both
 * runtime and unit-test contexts.
 *
 * TODO(P1): when the host gains an async `deactivate(): Promise<void>` hook,
 * wrap the master disposer to flush in-flight async work before returning.
 */
export const activate = (): DisposableLike => {
  const commandDisposables = registerChatbotCommands();
  const viewDisposable = views.registerView(
    {
      id: VIEW_ID,
      name: 'Reference Chatbot',
      icon: 'Bubble',
      description: 'Validates the chatbot extension environment end-to-end.',
    },
    CHATBOT_LOCATION,
    () => React.createElement(ReferenceChatbot),
  );

  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        abortAllActiveControllers();
      } catch {
        // streams are best-effort during teardown
      }
      commandDisposables.forEach(d => {
        try {
          d.dispose();
        } catch {
          // a single command failing to unregister must not block the rest
        }
      });
      try {
        viewDisposable.dispose();
      } catch {
        // ignore
      }
      resetState();
    },
  };
};
