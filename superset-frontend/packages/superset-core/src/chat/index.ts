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
 * Chat is a dedicated contribution type: an extension registers
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
 *   AcmeTrigger,
 *   AcmePanel,
 * );
 * ```
 */

import { ComponentType } from 'react';
import type { Disposable, Event } from '../common';

export interface Chat {
  /** The unique identifier for the chat. */
  id: string;
  /** The display name of the chat. */
  name: string;
  /** Optional description of the chat. */
  description?: string;
}

export type DisplayMode = 'floating' | 'panel';

/**
 * Registers a chat provider. Only one chat is active at a time; the most
 * recently registered chat wins. Disposing the returned Disposable unregisters
 * the chat.
 *
 * @param chat The chat descriptor (id, name).
 * @param trigger The trigger component — the collapsed bubble entry point.
 *   Owns dynamic state such as unread counts.
 * @param panel The panel component, rendered in either display mode. In
 *   'floating' mode it appears as an overlay; in 'panel' mode it is docked
 *   alongside the main content.
 * @returns A Disposable that unregisters the chat when disposed.
 *
 * @example
 * ```typescript
 * chat.registerChat(
 *   { id: 'acme.chat', name: 'Acme Chat' },
 *   AcmeTrigger,
 *   AcmePanel,
 * );
 * ```
 */
export declare function registerChat(
  chat: Chat,
  trigger: ComponentType,
  panel: ComponentType,
): Disposable;

/**
 * Returns the active chat descriptor, or undefined if none is registered.
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
 */
export declare function isOpen(): boolean;

/**
 * Event fired when the chat panel opens. Also fired by the host's own
 * controls, not only by an extension's open() call.
 */
export declare const onDidOpen: Event<void>;

/**
 * Event fired when the chat panel closes, whether triggered by an extension
 * or by the host.
 */
export declare const onDidClose: Event<void>;

/**
 * Returns the current display mode.
 */
export declare function getDisplayMode(): DisplayMode;

/**
 * Sets the display mode. The mode is host-global and applies to whichever
 * chat is active. Use {@link onDidChangeDisplayMode} to observe all changes,
 * including those triggered by the host.
 */
export declare function setDisplayMode(displayMode: DisplayMode): void;

/**
 * Event fired when the display mode changes, whether triggered by an
 * extension via setDisplayMode() or by host-provided controls.
 */
export declare const onDidChangeDisplayMode: Event<DisplayMode>;

/**
 * Event fired when the panel is resized in panel mode. Not all hosts provide
 * a resizer — do not rely on this event firing.
 */
export declare const onDidResizePanel: Event<{ width: number }>;

// TODO: client actions API — tool availability functions will be added here
// once the client_actions SIP is finalized. The chat namespace is the
// intended integration point between the two SIPs.
