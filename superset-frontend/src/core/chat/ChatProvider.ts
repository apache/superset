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
type McpTool = chatApi.McpTool;
type ClaudeToolSpec = chatApi.ClaudeToolSpec;
type McpToolsFormat = chatApi.McpToolsFormat;

// The real value backing @apache-superset/core's `declare const
// McpToolsFormat` — that package only ever declares (see its own docs on
// why this isn't a TS `enum`); this is the actual object attached to
// `window.superset.chat.McpToolsFormat` (re-exported from ./index).
export const McpToolsFormat = {
  Claude: 'claude',
  AgUi: 'ag-ui',
  CopilotKit: 'copilot-kit',
  Codex: 'codex',
} as const;

// AgUi/CopilotKit/Codex have no real transform below — see
// @apache-superset/core's McpToolsFormat docs for why (no framework in this
// codebase actually talks to any of them yet, so there's no verified target
// shape to convert to). Throwing a clear, named error beats either
// silently returning the native McpTool[] (wrong shape, and callers can
// already get that from a plain getTools()) or returning an empty array
// (looks like "this source has no tools" instead of "this format isn't
// implemented").
function notYetImplemented(
  formatKey: keyof typeof McpToolsFormat,
): () => never {
  return () => {
    throw new Error(
      `[Superset] chat.getTools(chat.McpToolsFormat.${formatKey}) is not ` +
        'yet implemented — no framework in this codebase talks to this ' +
        'format yet, so there is no verified target shape to convert to. ' +
        'Add a real transform to MCP_TOOLS_FORMATTERS in ChatProvider.ts ' +
        'once there is one to verify against, rather than guessing at it here.',
    );
  };
}

// One entry per McpToolsFormat member — see that constant's own docs for
// why only Claude has a real transform. Keeping each target's transform (or
// placeholder) here, keyed by the same object, is what makes adding a real
// one later a single changed entry rather than a change to getTools()
// itself.
const MCP_TOOLS_FORMATTERS: {
  [K in McpToolsFormat]: (tools: McpTool[]) => unknown[];
} = {
  [McpToolsFormat.Claude]: (tools: McpTool[]): ClaudeToolSpec[] =>
    tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    })),
  [McpToolsFormat.AgUi]: notYetImplemented('AgUi'),
  [McpToolsFormat.CopilotKit]: notYetImplemented('CopilotKit'),
  [McpToolsFormat.Codex]: notYetImplemented('Codex'),
};

// The client MCP tools SIP's eight product surfaces (mirrors the per-surface
// folders under superset-frontend/src/core/mcpTools) — every tool name must
// start with one of these.
const MCP_TOOL_SURFACES = [
  'dashboard',
  'chart',
  'sqlLab',
  'dataset',
  'alert',
  'report',
  'cssTemplate',
  'savedQuery',
] as const;

// e.g. "dashboard__get_root" — a surface, then "__", then the tool's own
// name. Deliberately allows no ".": that character is reserved for the
// "core."/"<extension-id>." prefix registerTools() adds itself below, so a
// tool author's own `name` containing one is always a mistake — most
// commonly typing "core." or "extensions." by hand instead of just leaving
// the prefix off.
const MCP_TOOL_NAME_PATTERN = new RegExp(
  `^(${MCP_TOOL_SURFACES.join('|')})__[a-zA-Z0-9_]+$`,
);

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

  // Keyed by source id ("core" for the host's built-ins, an extension id for
  // everything else) so a given source's tools can be swapped out wholesale
  // (e.g. on hot reload) without touching any other source's contribution.
  private toolsBySource = new Map<string, McpTool[]>();

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

  /**
   * Registers `sourceId`'s (`"core"`, or an extension's id) client-side
   * tools, replacing any it previously registered. Each tool's `name` is
   * authored WITHOUT a source prefix (e.g. `"dashboard__get_root"`, not
   * `"core.dashboard__get_root"` or `"my-ext.dashboard__get_root"`) — this
   * method adds it, so the same tool definition works unchanged regardless
   * of which source registers it. A name that doesn't start with one of
   * `MCP_TOOL_SURFACES` (most commonly because a "." — and therefore
   * already-prefixed-looking name like "core.foo" or "extensions.foo" —
   * snuck in) is rejected outright, logged, and left out of the registered
   * set entirely, rather than registered as-is or silently dropped without
   * explanation.
   *
   * Since the prefix is always unique per source (there is exactly one
   * "core", and every extension id is globally unique), the qualified name
   * this produces can never collide with another SOURCE's — the only
   * remaining way to get a duplicate is one source registering the same
   * unprefixed name twice in the same call, which is warned on and only the
   * first kept, rather than left for whichever tool lookup happens to see
   * second to silently win.
   */
  public registerTools(sourceId: string, tools: McpTool[]): Disposable {
    const prefix = sourceId === 'core' ? 'core' : sourceId;
    const seenNames = new Set<string>();
    const qualifiedTools: McpTool[] = [];
    tools.forEach(tool => {
      if (!MCP_TOOL_NAME_PATTERN.test(tool.name)) {
        // eslint-disable-next-line no-console
        console.error(
          `[Superset] Rejecting mcpTool "${tool.name}" from "${sourceId}": ` +
            `name must start with one of ${MCP_TOOL_SURFACES.join(', ')}, ` +
            'followed by "__", and contain no ".". The source\'s own ' +
            `prefix ("${prefix}.") is added automatically — do not include ` +
            '"core.", "extensions.", or any other prefix yourself.',
        );
        return;
      }
      if (seenNames.has(tool.name)) {
        // eslint-disable-next-line no-console
        console.warn(
          `[Superset] "${sourceId}" registered mcpTool "${tool.name}" more ` +
            'than once; keeping only the first.',
        );
        return;
      }
      seenNames.add(tool.name);
      qualifiedTools.push({ ...tool, name: `${prefix}.${tool.name}` });
    });

    this.toolsBySource.set(sourceId, qualifiedTools);
    return new Disposable(() => {
      if (this.toolsBySource.get(sourceId) !== qualifiedTools) return;
      this.toolsBySource.delete(sourceId);
    });
  }

  public getTools(): McpTool[];

  public getTools(format: typeof McpToolsFormat.Claude): ClaudeToolSpec[];

  public getTools(format: McpToolsFormat): unknown[];

  public getTools(
    format?: McpToolsFormat,
  ): McpTool[] | ClaudeToolSpec[] | unknown[] {
    const tools = [...this.toolsBySource.values()].flat();
    if (!format) return tools;
    return MCP_TOOLS_FORMATTERS[format](tools);
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
    this.toolsBySource.clear();
    setItem(LocalStorageKeys.ChatState, { open: false, mode: 'floating' });
  }
}

export default ChatProvider;
