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
 * @fileoverview Chat contribution API for Superset extensions.
 *
 * Chat is a dedicated contribution type (not a view): an extension registers
 * a chat via {@link registerChat} and the host owns where and how it is
 * mounted. The host applies singleton resolution — multiple chat extensions
 * may register, but exactly one is active at a time.
 *
 * @example
 * ```typescript
 * import { chat } from '@apache-superset/core';
 *
 * chat.registerChat(
 *   { id: 'acme.chat', name: 'Acme Chat' },
 *   () => <AcmeTrigger />,
 *   () => <AcmePanel />,
 * );
 * ```
 */

import { ReactElement } from 'react';
import type { Disposable, Event } from '../common';

export interface Chat {
  /** The unique identifier for the chat. */
  id: string;
  /** The display name of the chat. */
  name: string;
  /** Optional description of the chat, for display in contribution manifests. */
  description?: string;
}

export type ChatMode = 'floating' | 'panel';

/**
 * Registers a chat provider. The host applies singleton resolution — only one
 * chat is active at a time: the most recently registered chat wins, and
 * disposing it restores the previously registered one. Re-registering an id
 * replaces that registration in place.
 *
 * When a registration with a different id takes over the active slot (or the
 * active chat is disposed), the host closes the panel first, firing
 * {@link onDidClose}; an in-place same-id replacement keeps the open state.
 *
 * Disposing the returned Disposable unregisters the chat.
 *
 * @param chat The chat descriptor (id, name).
 * @param trigger A function returning the collapsed bubble element. Owned by
 *   the extension — dynamic state such as unread counts and badges lives here.
 *   Hidden by the host when in panel mode.
 * @param panel A function returning the chat panel element. Mounted by the
 *   host as a floating overlay in 'floating' mode, or docked at the side of
 *   the viewport in 'panel' mode (the reference host docks a fixed-width
 *   overlay at the right edge; hosts may integrate a true layout slot
 *   instead). Same component in both modes.
 * @returns A Disposable that unregisters the chat when disposed.
 *
 * @example
 * ```typescript
 * chat.registerChat(
 *   { id: 'acme.chat', name: 'Acme Chat' },
 *   () => <AcmeTrigger />,
 *   () => <AcmePanel />,
 * );
 * ```
 */
export declare function registerChat(
  chat: Chat,
  trigger: () => ReactElement,
  panel: () => ReactElement,
): Disposable;

/**
 * Returns the active chat descriptor.
 *
 * @returns A copy of the active Chat descriptor, or undefined if none is
 *   registered. Mutating the returned object has no effect on the registry.
 */
export declare function getChat(): Chat | undefined;

/**
 * Event fired when a chat is registered.
 */
export declare const onDidRegisterChat: Event<Chat>;

/**
 * Event fired when a chat is unregistered.
 */
export declare const onDidUnregisterChat: Event<Chat>;

/**
 * Opens the active chat's panel.
 *
 * Acts on whichever chat is active, regardless of which extension calls it.
 * No-op when no chat is registered or the panel is already open.
 */
export declare function open(): void;

/**
 * Closes the active chat's panel.
 *
 * Acts on whichever chat is active, regardless of which extension calls it.
 * No-op when the panel is not open.
 */
export declare function close(): void;

/**
 * Returns whether the active chat's panel is currently open.
 *
 * @returns True if the chat panel is open.
 */
export declare function isOpen(): boolean;

/**
 * Event fired when the chat panel opens, with the descriptor of the chat
 * whose panel opened. Listen to this rather than assuming your own chat is
 * the one affected — another registration may hold the active slot.
 */
export declare const onDidOpen: Event<Chat>;

/**
 * Event fired when the chat panel closes, with the descriptor of the chat
 * whose panel closed. Also fired when the host closes the panel itself, e.g.
 * because the active chat was disposed or displaced by a different chat.
 */
export declare const onDidClose: Event<Chat>;

/**
 * Returns the current display mode.
 *
 * @returns The current ChatMode.
 */
export declare function getMode(): ChatMode;

/**
 * Sets the display mode.
 *
 * The mode is host-global and applies to whichever chat is active, regardless
 * of which extension calls it. Hosts may also change the mode through their
 * own controls — use onDidChangeMode to observe all changes rather than
 * assuming the last setMode() call won.
 *
 * @param mode The display mode to switch to.
 */
export declare function setMode(mode: ChatMode): void;

/**
 * Event fired when the display mode changes, whether triggered by an
 * extension via setMode() or by host-provided controls.
 */
export declare const onDidChangeMode: Event<ChatMode>;

/**
 * Event fired when the panel is resized in panel mode.
 *
 * The host owns the resizer handle and drag interaction; a host without a
 * resizer never fires this event. (The reference host mounts the panel at a
 * fixed width and does not provide a resizer, so subscribers receive no
 * events there.) Listen to this event to adapt internal layout to the
 * available width; do not rely on it firing.
 */
export declare const onDidResizePanel: Event<{ width: number }>;

// TODO: client actions API — tool availability functions will be added here
// once the client_actions SIP is finalized. The chat namespace is the
// intended integration point between the two SIPs.
