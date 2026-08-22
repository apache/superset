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

import { ComponentType } from 'react';
import type { chat as chatApi } from '@apache-superset/core';
import { logging } from '@apache-superset/core/utils';
import {
  LocalStorageKeys,
  getItem,
  setItem,
} from 'src/utils/localStorageHelpers';
import { Disposable } from '../models';
import { createValueEventEmitter, createEventEmitter } from '../utils';

type Chat = chatApi.Chat;
type DisplayMode = chatApi.DisplayMode;
type ClientTool = chatApi.ClientTool;
type RegisterChatOptions = chatApi.RegisterChatOptions;

/**
 * Singleton manager for the chat provider.
 * Handles registration, open/close state, and display mode.
 */
class ChatProvider {
  private static instance: ChatProvider;

  private chat: Chat | undefined;

  private trigger: ComponentType | undefined;

  private panel: ComponentType | undefined;

  private opened: boolean;

  private stateSubscribers = new Set<() => void>();

  // Keyed by the tool's own (fully-qualified) name — same flat-Map shape as
  // commands.ts's registerCommand, which this mirrors.
  private clientTools = new Map<string, ClientTool>();

  private registerEmitter = createEventEmitter<Chat>();

  private unregisterEmitter = createEventEmitter<Chat>();

  private openEmitter = createEventEmitter<void>();

  private closeEmitter = createEventEmitter<void>();

  private resizePanelEmitter = createEventEmitter<{ width: number }>();

  private modeEmitter: ReturnType<typeof createValueEventEmitter<DisplayMode>>;

  private constructor() {
    const persisted = getItem(LocalStorageKeys.ChatState, {
      open: false,
      mode: 'floating',
    });
    const mode = (
      persisted.mode === 'panel' ? 'panel' : 'floating'
    ) as DisplayMode;
    this.opened = persisted.open === true;
    this.modeEmitter = createValueEventEmitter<DisplayMode>(mode);
  }

  public static getInstance(): ChatProvider {
    if (!ChatProvider.instance) {
      ChatProvider.instance = new ChatProvider();
    }
    return ChatProvider.instance;
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.stateSubscribers.add(listener);
    return () => this.stateSubscribers.delete(listener);
  };

  private notifyState(): void {
    setItem(LocalStorageKeys.ChatState, {
      open: this.opened,
      mode: this.modeEmitter.getCurrent(),
    });
    this.stateSubscribers.forEach(fn => fn());
  }

  private closePanel(): void {
    this.opened = false;
    this.closeEmitter.fire();
  }

  public registerChat(
    chat: Chat,
    trigger: ComponentType,
    panel: ComponentType,
    options?: RegisterChatOptions,
  ): Disposable {
    if (this.chat) {
      // eslint-disable-next-line no-console
      console.warn(
        `[Superset] Multiple chat extensions registered. Using "${chat.id}"; discarding "${this.chat.id}".`,
      );
      this.unregisterEmitter.fire(this.chat);
      if (this.opened) this.closePanel();
    }

    this.chat = chat;
    this.trigger = trigger;
    this.panel = panel;
    this.registerEmitter.fire(chat);
    this.notifyState();

    const disposeChat = new Disposable(() => {
      if (this.chat !== chat) return;
      this.chat = undefined;
      this.trigger = undefined;
      this.panel = undefined;
      this.unregisterEmitter.fire(chat);
      if (this.opened) this.closePanel();
      this.notifyState();
    });

    return options?.tools?.length
      ? Disposable.from(disposeChat, this.registerClientTools(options.tools))
      : disposeChat;
  }

  public getChat(): Chat | undefined {
    return this.chat;
  }

  public getTrigger(): ComponentType | undefined {
    return this.trigger;
  }

  public getPanel(): ComponentType | undefined {
    return this.panel;
  }

  public open(): void {
    if (this.opened || !this.chat) return;
    this.opened = true;
    this.openEmitter.fire();
    this.notifyState();
  }

  public close(): void {
    if (!this.opened || !this.chat) return;
    this.closePanel();
    this.notifyState();
  }

  public isOpen(): boolean {
    return this.opened;
  }

  public getDisplayMode(): DisplayMode {
    return this.modeEmitter.getCurrent();
  }

  public setDisplayMode(displayMode: DisplayMode): void {
    if (displayMode === this.modeEmitter.getCurrent()) return;
    this.modeEmitter.fire(displayMode);
    this.notifyState();
  }

  public get onDidRegisterChat() {
    return this.registerEmitter.subscribe;
  }

  public get onDidUnregisterChat() {
    return this.unregisterEmitter.subscribe;
  }

  public get onDidOpen() {
    return this.openEmitter.subscribe;
  }

  public get onDidClose() {
    return this.closeEmitter.subscribe;
  }

  public get onDidChangeDisplayMode() {
    return this.modeEmitter.subscribe;
  }

  public get onDidResizePanel() {
    return this.resizePanelEmitter.subscribe;
  }

  /**
   * Registers a single client-side tool — mirrors commands.ts's
   * registerCommand exactly: keyed by the tool's own `name` (fully-qualified,
   * author-chosen — nothing prefixes or validates it here, same as a
   * `Command.id`), warns and overwrites on a duplicate name, and the
   * returned Disposable removes it by name unconditionally on dispose.
   *
   * Registering after registerChat() is safe — nothing here depends on call
   * order. (An earlier version of this method warned about that ordering,
   * back when ChatPanel snapshotted `chat.getTools()` once at mount via
   * `useMemo(..., [])`; the actual fix was moving that snapshot to send-time
   * in ChatPanel itself, which made the order genuinely not matter rather
   * than just warning about it.)
   */
  public registerClientTool(tool: ClientTool): Disposable {
    const { name } = tool;
    if (this.clientTools.has(name)) {
      logging.warn(
        `[Superset] Client tool "${name}" is already registered. ` +
          'Overwriting the existing tool.',
      );
    }
    this.clientTools.set(name, tool);
    return new Disposable(() => {
      this.clientTools.delete(name);
    });
  }

  /**
   * Registers a list of tools in one call — equivalent to mapping
   * {@link registerClientTool} over `tools` yourself, bundled into a single
   * Disposable that unregisters all of them.
   */
  public registerClientTools(tools: ClientTool[]): Disposable {
    return Disposable.from(...tools.map(tool => this.registerClientTool(tool)));
  }

  public getTools(): ClientTool[] {
    return [...this.clientTools.values()];
  }

  public reset(): void {
    this.chat = undefined;
    this.trigger = undefined;
    this.panel = undefined;
    this.opened = false;
    this.registerEmitter = createEventEmitter<Chat>();
    this.unregisterEmitter = createEventEmitter<Chat>();
    this.openEmitter = createEventEmitter<void>();
    this.closeEmitter = createEventEmitter<void>();
    this.resizePanelEmitter = createEventEmitter<{ width: number }>();
    this.modeEmitter = createValueEventEmitter<DisplayMode>('floating');
    this.stateSubscribers.clear();
    this.clientTools.clear();
    setItem(LocalStorageKeys.ChatState, { open: false, mode: 'floating' });
  }
}

export default ChatProvider;
