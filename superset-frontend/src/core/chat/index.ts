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
 * Chat is a dedicated contribution type, not a view: extensions register via
 * the public `chat.registerChat()` and the host owns mounting, open/close
 * state, and the display mode. Multiple chat extensions may register, but the
 * host applies singleton resolution — the most-recently-registered chat is
 * active; disposing it falls back to the previous one.
 *
 * The public namespace (`chat`) is exposed to extensions on
 * `window.superset`; the other exports are host-internal accessors for
 * ChatMount and are NOT part of the public `@apache-superset/core` API.
 */

import { ReactElement } from 'react';
import type { chat as chatApi } from '@apache-superset/core';
import { Disposable } from '../models';
import { createEmitter, createEventEmitter } from '../utils';

type Chat = chatApi.Chat;
type ChatMode = chatApi.ChatMode;

/** A registered chat: its descriptor plus the host-mountable providers. */
export interface RegisteredChat {
  /** The chat descriptor passed to `registerChat`. */
  chat: Chat;
  /** Renders the collapsed bubble. Hidden by the host in panel mode. */
  trigger: () => ReactElement;
  /** Renders the chat panel, mounted per the current {@link ChatMode}. */
  panel: () => ReactElement;
}

/** Registration order is the singleton-resolution order: last entry wins. */
const registrations: RegisteredChat[] = [];

let panelOpen = false;

const registerEmitter = createEventEmitter<Chat>();
const unregisterEmitter = createEventEmitter<Chat>();
const openEmitter = createEventEmitter<void>();
const closeEmitter = createEventEmitter<void>();
const resizePanelEmitter = createEventEmitter<{ width: number }>();
const modeEmitter = createEmitter<ChatMode>('floating');

/**
 * Monotonic version of the whole chat state (registrations, open state, and
 * mode). Bumped on every change so the host UI can re-derive state via
 * React's `useSyncExternalStore`.
 */
let stateVersion = 0;
const stateSubscribers = new Set<() => void>();

const notifyState = () => {
  stateVersion += 1;
  stateSubscribers.forEach(fn => fn());
};

export const subscribeToChatState = (listener: () => void): (() => void) => {
  stateSubscribers.add(listener);
  return () => {
    stateSubscribers.delete(listener);
  };
};

export const getChatStateVersion = () => stateVersion;

/**
 * Host-internal: resolves the active chat with its providers.
 * The most-recently-registered chat wins; when it is disposed the previous
 * registration takes over the slot again.
 */
export const getActiveChat = (): RegisteredChat | undefined =>
  registrations[registrations.length - 1];

const registerChat: typeof chatApi.registerChat = (
  chat: Chat,
  trigger: () => ReactElement,
  panel: () => ReactElement,
): Disposable => {
  // Re-registering an id replaces the previous entry and moves it to the
  // most-recent position, mirroring the view registry's same-id semantics.
  const existingIndex = registrations.findIndex(r => r.chat.id === chat.id);
  if (existingIndex !== -1) {
    registrations.splice(existingIndex, 1);
  }

  const entry: RegisteredChat = { chat, trigger, panel };
  registrations.push(entry);
  registerEmitter.fire(chat);
  notifyState();

  return new Disposable(() => {
    const index = registrations.indexOf(entry);
    if (index === -1) {
      // Already removed — replaced by a same-id registration or disposed twice.
      return;
    }
    registrations.splice(index, 1);
    unregisterEmitter.fire(chat);
    notifyState();
  });
};

const getChat: typeof chatApi.getChat = (): Chat | undefined =>
  getActiveChat()?.chat;

const open: typeof chatApi.open = (): void => {
  if (panelOpen) return;
  panelOpen = true;
  openEmitter.fire(undefined);
  notifyState();
};

const close: typeof chatApi.close = (): void => {
  if (!panelOpen) return;
  panelOpen = false;
  closeEmitter.fire(undefined);
  notifyState();
};

const isOpen: typeof chatApi.isOpen = (): boolean => panelOpen;

const getMode: typeof chatApi.getMode = (): ChatMode =>
  modeEmitter.getCurrent();

const setMode: typeof chatApi.setMode = (mode: ChatMode): void => {
  if (mode === modeEmitter.getCurrent()) return;
  modeEmitter.fire(mode);
  notifyState();
};

export const chat: typeof chatApi = {
  registerChat,
  getChat,
  onDidRegisterChat: registerEmitter.event,
  onDidUnregisterChat: unregisterEmitter.event,
  open,
  close,
  isOpen,
  onDidOpen: openEmitter.event,
  onDidClose: closeEmitter.event,
  getMode,
  setMode,
  onDidChangeMode: modeEmitter.event,
  // The host fires this from its panel resizer; until that chrome exists the
  // event is exposed but never fires.
  onDidResizePanel: resizePanelEmitter.event,
};
