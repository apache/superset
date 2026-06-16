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
 * Open-state policy across active-chat transitions: when the active chat's
 * identity changes — a takeover by a different id, disposal falling back to a
 * different id, or disposal of the last chat — the panel is closed (firing
 * `onDidClose`) so the incoming chat never mounts into an open state it did
 * not request. A same-id re-registration is an upgrade in place and keeps the
 * open state.
 *
 * The public namespace (`chat`) is exposed to extensions on
 * `window.superset`; the other exports are host-internal accessors for
 * ChatMount and are NOT part of the public `@apache-superset/core` API.
 */

import { ReactElement } from 'react';
import type { chat as chatApi } from '@apache-superset/core';
import { Disposable } from '../models';
import { createValueEventEmitter, createEventEmitter } from '../utils';

type Chat = chatApi.Chat;
type DisplayMode = chatApi.DisplayMode;

/** A registered chat: its descriptor plus the host-mountable providers. */
export interface RegisteredChat {
  /** The chat descriptor passed to `registerChat`. */
  chat: Chat;
  /** Renders the collapsed bubble. Hidden by the host in panel mode. */
  trigger: () => ReactElement;
  /** Renders the chat panel, mounted per the current {@link DisplayMode}. */
  panel: () => ReactElement;
  /**
   * Unique per registration (a same-id re-registration gets a new one). The
   * host UI keys mounts and fault containment on it, so a replacement resets
   * crashed error boundaries instead of inheriting their latched state.
   */
  registrationId: number;
}

/**
 * Immutable snapshot of the whole chat state, rebuilt on every change.
 * Returned by reference from `getChatSnapshot` so `useSyncExternalStore`
 * consumers read registrations, open state, and mode from one consistent
 * object instead of tearing across separate live reads.
 */
export interface ChatSnapshot {
  /** Monotonic change counter, useful as a memo/effect dependency. */
  version: number;
  /** Whether the active chat's panel is open. */
  open: boolean;
  /** The current display mode. */
  mode: DisplayMode;
  /** The active registration, or undefined when none is registered. */
  active: RegisteredChat | undefined;
}

/** Registration order is the singleton-resolution order: last entry wins. */
const registrations: RegisteredChat[] = [];

let panelOpen = false;
let nextRegistrationId = 1;

const registerEmitter = createEventEmitter<Chat>();
const unregisterEmitter = createEventEmitter<Chat>();
const openEmitter = createEventEmitter<void>();
const closeEmitter = createEventEmitter<void>();
const resizePanelEmitter = createEventEmitter<{ width: number }>();
const modeEmitter = createValueEventEmitter<DisplayMode>('floating');

/**
 * Host-internal: resolves the active chat with its providers.
 * The most-recently-registered chat wins; when it is disposed the previous
 * registration takes over the slot again.
 */
export const getActiveChat = (): RegisteredChat | undefined =>
  registrations[registrations.length - 1];

let snapshot: ChatSnapshot = {
  version: 0,
  open: false,
  mode: modeEmitter.getCurrent(),
  active: undefined,
};

const stateSubscribers = new Set<() => void>();

const notifyState = () => {
  snapshot = {
    version: snapshot.version + 1,
    open: panelOpen,
    mode: modeEmitter.getCurrent(),
    active: getActiveChat(),
  };
  stateSubscribers.forEach(fn => fn());
};

export const subscribeToChatState = (listener: () => void): (() => void) => {
  stateSubscribers.add(listener);
  return () => {
    stateSubscribers.delete(listener);
  };
};

export const getChatSnapshot = (): ChatSnapshot => snapshot;

/** Closes the panel and fires `onDidClose`. */
const closePanel = () => {
  panelOpen = false;
  closeEmitter.fire();
};

const registerChat: typeof chatApi.registerChat = (
  chat: Chat,
  trigger: () => ReactElement,
  panel: () => ReactElement,
): Disposable => {
  const previousActive = getActiveChat();

  // Re-registering an id replaces the previous entry and moves it to the
  // most-recent position, mirroring the view registry's same-id semantics.
  const existingIndex = registrations.findIndex(r => r.chat.id === chat.id);
  if (existingIndex !== -1) {
    registrations.splice(existingIndex, 1);
  }

  const entry: RegisteredChat = {
    chat,
    trigger,
    panel,
    registrationId: nextRegistrationId,
  };
  nextRegistrationId += 1;
  registrations.push(entry);
  registerEmitter.fire(chat);

  // A takeover by a different id closes the displaced chat's panel so the
  // incoming chat never mounts already-open; a same-id replacement is an
  // upgrade in place and keeps the open state.
  if (panelOpen && previousActive && previousActive.chat.id !== chat.id) {
    closePanel();
  }
  notifyState();

  return new Disposable(() => {
    const index = registrations.indexOf(entry);
    if (index === -1) {
      // Already removed — replaced by a same-id registration or disposed twice.
      return;
    }
    const wasActive = getActiveChat() === entry;
    registrations.splice(index, 1);
    unregisterEmitter.fire(chat);
    // Disposing the active chat closes its panel; the fallback chat (if any)
    // starts closed. Disposing an inactive registration leaves the open
    // state of the active chat untouched.
    if (panelOpen && wasActive) {
      closePanel();
    }
    notifyState();
  });
};

const getChat: typeof chatApi.getChat = (): Chat | undefined => {
  const active = getActiveChat();
  // Copy so extensions cannot mutate another extension's descriptor.
  return active ? { ...active.chat } : undefined;
};

const open: typeof chatApi.open = (): void => {
  const active = getActiveChat();
  // Open state only exists while a chat is registered; opening an empty slot
  // would otherwise leak `open` into a future, unrelated registration.
  if (panelOpen || !active) return;
  panelOpen = true;
  openEmitter.fire();
  notifyState();
};

const close: typeof chatApi.close = (): void => {
  const active = getActiveChat();
  if (!panelOpen || !active) return;
  closePanel();
  notifyState();
};

const isOpen: typeof chatApi.isOpen = (): boolean => panelOpen;

const getDisplayMode: typeof chatApi.getDisplayMode = (): DisplayMode =>
  modeEmitter.getCurrent();

const setDisplayMode: typeof chatApi.setDisplayMode = (
  displayMode: DisplayMode,
): void => {
  if (displayMode === modeEmitter.getCurrent()) return;
  modeEmitter.fire(displayMode);
  notifyState();
};

export const chat: typeof chatApi = {
  registerChat,
  getChat,
  onDidRegisterChat: registerEmitter.subscribe,
  onDidUnregisterChat: unregisterEmitter.subscribe,
  open,
  close,
  isOpen,
  onDidOpen: openEmitter.subscribe,
  onDidClose: closeEmitter.subscribe,
  getDisplayMode,
  setDisplayMode,
  onDidChangeDisplayMode: modeEmitter.subscribe,
  // The host fires this from its panel resizer; until that chrome exists the
  // event is exposed but never fires.
  onDidResizePanel: resizePanelEmitter.subscribe,
};
