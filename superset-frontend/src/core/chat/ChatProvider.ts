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
type ClientToolResult = chatApi.ClientToolResult;
type ClientToolSpec = chatApi.ClientToolSpec;

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

  private registerEmitter = createEventEmitter<Chat>();

  private unregisterEmitter = createEventEmitter<Chat>();

  private openEmitter = createEventEmitter<void>();

  private closeEmitter = createEventEmitter<void>();

  private resizePanelEmitter = createEventEmitter<{ width: number }>();

  private clientToolGroups: ClientTool[][] = [];

  private clientToolsEmitter = createEventEmitter<ClientToolSpec[]>();

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

    return new Disposable(() => {
      if (this.chat !== chat) return;
      this.chat = undefined;
      this.trigger = undefined;
      this.panel = undefined;
      this.unregisterEmitter.fire(chat);
      if (this.opened) this.closePanel();
      this.notifyState();
    });
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

  private resolveClientTools(): Map<string, ClientTool> {
    const resolved = new Map<string, ClientTool>();
    this.clientToolGroups.forEach(group => {
      group.forEach(tool => resolved.set(tool.name, tool));
    });
    return resolved;
  }

  public registerClientTools(tools: readonly ClientTool[]): Disposable {
    const group = [...tools];
    this.clientToolGroups.push(group);
    this.clientToolsEmitter.fire(this.getClientTools());

    return new Disposable(() => {
      const index = this.clientToolGroups.indexOf(group);
      if (index === -1) return;
      this.clientToolGroups.splice(index, 1);
      this.clientToolsEmitter.fire(this.getClientTools());
    });
  }

  public getClientTools(): ClientToolSpec[] {
    return [...this.resolveClientTools().values()].map(
      ({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      }),
    );
  }

  public async executeClientTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ClientToolResult> {
    const tool = this.resolveClientTools().get(name);
    if (!tool) {
      return { content: `Unknown client tool "${name}".`, isError: true };
    }

    try {
      const result = await tool.execute(args);
      if (result && typeof result.content === 'string') return result;
      return {
        content: `Client tool "${name}" returned no content.`,
        isError: true,
      };
    } catch (error) {
      return {
        content:
          error instanceof Error
            ? `Client tool "${name}" failed: ${error.message}`
            : `Client tool "${name}" failed.`,
        isError: true,
      };
    }
  }

  public get onDidChangeClientTools() {
    return this.clientToolsEmitter.subscribe;
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
    this.clientToolGroups = [];
    this.clientToolsEmitter = createEventEmitter<ClientToolSpec[]>();
    this.modeEmitter = createValueEventEmitter<DisplayMode>('floating');
    this.stateSubscribers.clear();
    setItem(LocalStorageKeys.ChatState, { open: false, mode: 'floating' });
  }
}

export default ChatProvider;
