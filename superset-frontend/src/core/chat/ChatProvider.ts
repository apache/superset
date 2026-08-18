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
type ClaudeToolSpec = chatApi.ClaudeToolSpec;
type ClientToolsFormat = chatApi.ClientToolsFormat;

// The real value backing @apache-superset/core's `declare const
// ClientToolsFormat` — that package only ever declares (see its own docs on
// why this isn't a TS `enum`); this is the actual object attached to
// `window.superset.chat.ClientToolsFormat` (re-exported from ./index).
export const ClientToolsFormat = {
  Claude: 'claude',
  AgUi: 'ag-ui',
  CopilotKit: 'copilot-kit',
  Codex: 'codex',
} as const;

// AgUi/CopilotKit/Codex have no real transform below — see
// @apache-superset/core's ClientToolsFormat docs for why (no framework in
// this codebase actually talks to any of them yet, so there's no verified
// target shape to convert to). Throwing a clear, named error beats either
// silently returning the native ClientTool[] (wrong shape, and callers can
// already get that from a plain getTools()) or returning an empty array
// (looks like "this source has no tools" instead of "this format isn't
// implemented").
function notYetImplemented(
  formatKey: keyof typeof ClientToolsFormat,
): () => never {
  return () => {
    throw new Error(
      `[Superset] chat.getTools(chat.ClientToolsFormat.${formatKey}) is ` +
        'not yet implemented — no framework in this codebase talks to ' +
        'this format yet, so there is no verified target shape to convert ' +
        'to. Add a real transform to CLIENT_TOOLS_FORMATTERS in ' +
        'ChatProvider.ts once there is one to verify against, rather than ' +
        'guessing at it here.',
    );
  };
}

// One entry per ClientToolsFormat member — see that constant's own docs for
// why only Claude has a real transform. Keeping each target's transform (or
// placeholder) here, keyed by the same object, is what makes adding a real
// one later a single changed entry rather than a change to getTools()
// itself.
const CLIENT_TOOLS_FORMATTERS: {
  [K in ClientToolsFormat]: (tools: ClientTool[]) => unknown[];
} = {
  [ClientToolsFormat.Claude]: (tools: ClientTool[]): ClaudeToolSpec[] =>
    tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    })),
  [ClientToolsFormat.AgUi]: notYetImplemented('AgUi'),
  [ClientToolsFormat.CopilotKit]: notYetImplemented('CopilotKit'),
  [ClientToolsFormat.Codex]: notYetImplemented('Codex'),
};

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

  // Warned at most once per singleton lifetime (reset by reset()) — a whole
  // extension registering many tools after its own registerChat() call would
  // otherwise print one warning per tool, which adds noise without adding
  // information: it's the same one mistake either way.
  private hasWarnedAboutLateToolRegistration = false;

  // A chat panel that's already registered can mount synchronously (e.g. one
  // left open in a previous session — localStorage-persisted state makes
  // this the common case, not an edge case), and its first render calls
  // chat.getTools(). Registering tools after registerChat() risks that
  // render missing them; warning here catches the mistake instead of leaving
  // it to manifest as "the model can't see my tool" with no obvious cause.
  private warnIfRegisteredAfterChat(): void {
    if (!this.chat || this.hasWarnedAboutLateToolRegistration) return;
    this.hasWarnedAboutLateToolRegistration = true;
    logging.warn(
      '[Superset] chat.registerClientTool(s) was called after ' +
        'chat.registerChat() — register your tools BEFORE calling ' +
        'registerChat(), not after, so an already-open chat panel\'s first ' +
        "render can't call chat.getTools() before they exist. Example:\n\n" +
        '  chat.registerClientTools(myTools); // register first\n' +
        "  chat.registerChat({ id: 'my-ext', name: 'My Ext' }, Trigger, Panel); // then this\n",
    );
  }

  /**
   * Registers a single client-side tool — mirrors commands.ts's
   * registerCommand exactly: keyed by the tool's own `name` (fully-qualified,
   * author-chosen — nothing prefixes or validates it here, same as a
   * `Command.id`), warns and overwrites on a duplicate name, and the
   * returned Disposable removes it by name unconditionally on dispose.
   */
  public registerClientTool(tool: ClientTool): Disposable {
    this.warnIfRegisteredAfterChat();
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

  public getTools(): ClientTool[];

  public getTools(format: typeof ClientToolsFormat.Claude): ClaudeToolSpec[];

  public getTools(format: ClientToolsFormat): unknown[];

  public getTools(
    format?: ClientToolsFormat,
  ): ClientTool[] | ClaudeToolSpec[] | unknown[] {
    const tools = [...this.clientTools.values()];
    if (!format) return tools;
    // window.superset.chat.getTools() is reachable from untyped JS callers,
    // so `format` isn't guaranteed to actually be a ClientToolsFormat member
    // at runtime — indexing straight into CLIENT_TOOLS_FORMATTERS on a bad
    // value would fail with an opaque "undefined is not a function" instead
    // of a message naming the actual problem. Object.hasOwn (rather than
    // `in`) also keeps an inherited key like "toString" from resolving to
    // Object.prototype's own method instead of hitting this same error path.
    if (!Object.hasOwn(CLIENT_TOOLS_FORMATTERS, format)) {
      throw new Error(
        `[Superset] chat.getTools() was called with an unknown format ` +
          `"${format}" — expected one of ${Object.values(ClientToolsFormat).join(', ')}.`,
      );
    }
    return CLIENT_TOOLS_FORMATTERS[format](tools);
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
    this.hasWarnedAboutLateToolRegistration = false;
    setItem(LocalStorageKeys.ChatState, { open: false, mode: 'floating' });
  }
}

export default ChatProvider;
