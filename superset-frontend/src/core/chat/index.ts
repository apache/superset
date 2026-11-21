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
 * @fileoverview Host implementation of the `chat` contribution type.
 *
 * Extensions register via the public `chat.registerChat()` and the host owns
 * mounting, open/close state, and the display mode. Only the last-registered
 * chat is active at a time.
 *
 * The public namespace (`chat`) is exposed to extensions on `window.superset`.
 * `useChat` is host-internal and NOT part of the public `@apache-superset/core` API.
 */

import { useSyncExternalStore } from 'react';
import memoizeOne from 'memoize-one';
import type { chat as chatApi } from '@apache-superset/core';
import ChatProvider from './ChatProvider';

export { ChatFloatingHost, ChatPanelHost } from './ChatHost';

const provider = ChatProvider.getInstance();

const buildSnapshot = memoizeOne(
  (
    open: boolean,
    mode: chatApi.DisplayMode,
    chat: chatApi.Chat | undefined,
    trigger: ReturnType<typeof provider.getTrigger>,
    panel: ReturnType<typeof provider.getPanel>,
  ) => ({ open, mode, chat, trigger, panel }),
);

const getSnapshot = () =>
  buildSnapshot(
    provider.isOpen(),
    provider.getDisplayMode(),
    provider.getChat(),
    provider.getTrigger(),
    provider.getPanel(),
  );

/**
 * Host-internal hook. Returns the current open/mode state and the active chat
 * (trigger, panel, descriptor).
 */
export const useChat = () =>
  useSyncExternalStore(provider.subscribe, getSnapshot);

export const chat: typeof chatApi = {
  registerChat: provider.registerChat.bind(provider),
  getChat: provider.getChat.bind(provider),
  onDidRegisterChat: provider.onDidRegisterChat,
  onDidUnregisterChat: provider.onDidUnregisterChat,
  open: provider.open.bind(provider),
  close: provider.close.bind(provider),
  isOpen: provider.isOpen.bind(provider),
  onDidOpen: provider.onDidOpen,
  onDidClose: provider.onDidClose,
  getDisplayMode: provider.getDisplayMode.bind(provider),
  setDisplayMode: provider.setDisplayMode.bind(provider),
  onDidChangeDisplayMode: provider.onDidChangeDisplayMode,
  // The host fires this from its panel resizer; until that chrome exists the
  // event is exposed but never fires.
  onDidResizePanel: provider.onDidResizePanel,
};
