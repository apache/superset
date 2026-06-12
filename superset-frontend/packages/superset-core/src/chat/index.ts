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
 * Registers a chat provider. The host applies singleton resolution —
 * only one chat is active at a time per RFC §4.3.
 * Disposing the returned Disposable unregisters the chat.
 *
 * @param chat The chat descriptor (id, name).
 * @param trigger A function returning the collapsed bubble element. Owned by
 *   the extension — dynamic state such as unread counts and badges lives here.
 *   Hidden by the host when in panel mode.
 * @param panel A function returning the chat panel element. Mounted by the
 *   host as a floating overlay in 'floating' mode, or as a layout slot between
 *   the header and footer in 'panel' mode. Same component in both modes.
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
 * @returns The registered Chat descriptor, or undefined if none is registered.
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
 * Opens the chat panel.
 */
export declare function open(): void;

/**
 * Closes the chat panel.
 */
export declare function close(): void;

/**
 * Returns whether the chat panel is currently open.
 *
 * @returns True if the chat panel is open.
 */
export declare function isOpen(): boolean;

/**
 * Event fired when the chat panel opens.
 */
export declare const onDidOpen: Event<void>;

/**
 * Event fired when the chat panel closes.
 */
export declare const onDidClose: Event<void>;

/**
 * Returns the current display mode.
 *
 * @returns The current ChatMode.
 */
export declare function getMode(): ChatMode;

/**
 * Sets the display mode.
 *
 * The host supports both modes on all pages. The host also exposes a mode
 * toggle in its chrome — use onDidChangeMode to react to changes initiated
 * outside the extension.
 *
 * @param mode The display mode to switch to.
 */
export declare function setMode(mode: ChatMode): void;

/**
 * Event fired when the display mode changes, whether triggered by the
 * extension via setMode() or by the user through host-provided controls.
 */
export declare const onDidChangeMode: Event<ChatMode>;

/**
 * Event fired when the user resizes the panel in panel mode.
 *
 * The host owns the resizer handle and drag interaction. Listen to this
 * event to adapt internal layout to the available width.
 */
export declare const onDidResizePanel: Event<{ width: number }>;

// TODO: client actions API — tool availability functions will be added here
// once the client_actions SIP is finalized. The chat namespace is the
// intended integration point between the two SIPs.
