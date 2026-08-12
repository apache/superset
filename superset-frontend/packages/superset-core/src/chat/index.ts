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

/**
 * A client-side (frontend) tool the chat agent can call — see the "Client
 * MCP Tools" SIP. Unlike a backend/MCP-server tool, its handler runs in the
 * browser and can read/mutate whatever is currently on screen (e.g. the
 * Dashboard v2 canvas), so it works entirely off local state with no network
 * round trip of its own.
 *
 * Contributed either by the host itself (built-in "core" tools) or by an
 * extension via `mcpTools.url` in its extension.json — see that file's
 * `getMyTools(chat)`-shaped default export.
 */
export interface McpTool {
  /**
   * Unique name WITHOUT a source prefix, e.g. `dashboard__get_root` — the
   * host adds the `core.`/`<extension-id>.` prefix automatically when the
   * tool is registered, following the SIP's `[prefix].[surface]__[name]`
   * convention, so never write "core.", "extensions.", or any other prefix
   * here yourself. Must start with one of the SIP's eight product surfaces
   * (dashboard, chart, sqlLab, dataset, alert, report, cssTemplate,
   * savedQuery) followed by `__` — a name that doesn't is rejected (logged,
   * not registered) rather than silently accepted.
   */
  name: string;
  /** Describes what the tool does, so the LLM agent knows when to call it. */
  description: string;
  /** JSON Schema for the tool's input, e.g. `{ type: 'object', properties: {} }`. */
  inputSchema: Record<string, unknown>;
  /** Invoked with the model's tool-call arguments; return value is reported back as the tool result. */
  handler: (input: unknown) => Promise<unknown> | unknown;
}

/**
 * A target AI-service wire format `getTools()` can convert to — see
 * {@link getTools}'s overloads. Each member's transform lives alongside
 * `ChatProvider.getTools()`'s implementation
 * (`superset-frontend/src/core/chat/ChatProvider.ts`); adding a new member
 * here means adding one case there, not redesigning anything.
 *
 * A plain `const` object + derived union, not a TS `enum` — this file only
 * ever *declares* values (the real object lives in host code and is
 * attached to `window.superset.chat`, same as every function below), and a
 * real `enum`'s nominal typing doesn't structurally match a differently-built
 * object the way this does, which would make the two copies incompatible.
 *
 * `Claude` is the only member with a real, verified transform —
 * `devaigateway-provider`'s Anthropic SDK call, and `chat`'s own backend
 * `ToolSpec`, both expect exactly {@link ClaudeToolSpec}'s shape.
 * `AgUi`/`CopilotKit`/`Codex` are placeholders: nothing in this codebase
 * talks to any of those frameworks today, so there is no real tool-spec
 * shape here to convert to yet, and `getTools()` throws if one of them is
 * passed (see its own docs) rather than guessing at an unverified shape.
 * Replace a placeholder's `ChatProvider.ts` case with a real transform once
 * that framework's actual expected shape is known.
 */
export declare const McpToolsFormat: {
  readonly Claude: 'claude';
  readonly AgUi: 'ag-ui';
  readonly CopilotKit: 'copilot-kit';
  readonly Codex: 'codex';
};
export type McpToolsFormat =
  (typeof McpToolsFormat)[keyof typeof McpToolsFormat];

/**
 * `McpTool` reduced to what Anthropic's Messages API `tools` parameter
 * expects — `name`/`description` unchanged, `inputSchema` renamed to
 * `input_schema`, and `handler` dropped (a wire format sent to an external
 * API has no business carrying a callable). Look the tool back up via a
 * plain `getTools()` call (no format argument) to actually invoke it by
 * name — this type's whole point is to be JSON-serializable, so it
 * intentionally can't do that itself.
 */
export interface ClaudeToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Returns every client-side tool currently available — the host's own
 * built-in ("core") tools plus every loaded extension's `mcpTools.url`
 * contribution. Call this once tools are needed (e.g. when starting a chat
 * turn) rather than caching the result, since it can grow as extensions
 * finish loading.
 *
 * Called with no argument, returns `McpTool[]` as registered — each entry
 * keeps its `handler`, so this is what a tool-call dispatcher should look
 * tools up from by name. Called with {@link McpToolsFormat}'s `Claude`,
 * returns the same tools converted to {@link ClaudeToolSpec} instead — this
 * is what should actually be sent to an LLM API, since it can't serialize a
 * `handler` function. Called with any other `McpToolsFormat` member, throws:
 * those are placeholders for frameworks nothing here talks to yet (see that
 * type's own docs), not real, verified conversions.
 *
 * @example
 * ```typescript
 * import { chat } from '@apache-superset/core';
 *
 * const tools = chat.getTools(); // for dispatching a tool call by name
 * const toolSpecs = chat.getTools(chat.McpToolsFormat.Claude); // for the API request
 * ```
 */
export declare function getTools(): McpTool[];
export declare function getTools(
  format: typeof McpToolsFormat.Claude,
): ClaudeToolSpec[];
export declare function getTools(format: McpToolsFormat): never;

/**
 * The exact signature extension.json's `mcpTools.url` file's default export
 * must match — `typeof import('.')` here means "the `chat` namespace
 * itself", the same object an extension gets from
 * `import { chat } from '@apache-superset/core'`, so implementing against
 * this type is enough to get the parameter right without hand-writing
 * `(chat: typeof chatApi) => McpTool[]` again in every extension.
 *
 * @example
 * ```typescript
 * import type { chat } from '@apache-superset/core';
 *
 * const getMyTools: chat.McpToolsFactory = (chat) => [
 *   {
 *     name: 'dashboard__my_tool',
 *     description: '...',
 *     inputSchema: { type: 'object', properties: {} },
 *     handler: () => ({ success: true }),
 *   },
 * ];
 *
 * export default getMyTools;
 * ```
 */
export type McpToolsFactory = (chat: typeof import('.')) => McpTool[];
