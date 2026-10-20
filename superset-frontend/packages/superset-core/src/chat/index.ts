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
 * the chat (and, if passed, the {@link RegisterChatOptions.tools} registered
 * alongside it).
 *
 * @param chat The chat descriptor (id, name).
 * @param trigger The trigger component — the collapsed bubble entry point.
 *   Owns dynamic state such as unread counts.
 * @param panel The panel component, rendered in either display mode. In
 *   'floating' mode it appears as an overlay; in 'panel' mode it is docked
 *   alongside the main content.
 * @param options Optional extras. See {@link RegisterChatOptions}.
 * @returns A Disposable that unregisters the chat when disposed.
 *
 * @example
 * ```typescript
 * chat.registerChat(
 *   { id: 'acme.chat', name: 'Acme Chat' },
 *   AcmeTrigger,
 *   AcmePanel,
 *   { tools: getMyTools(chat) },
 * );
 * ```
 */
export declare function registerChat(
  chat: Chat,
  trigger: ComponentType,
  panel: ComponentType,
  options?: RegisterChatOptions,
): Disposable;

/**
 * Optional extras for {@link registerChat}.
 */
export interface RegisterChatOptions {
  /**
   * Client-side tools to register alongside this chat — a convenience
   * equivalent to calling {@link registerClientTools} yourself right after
   * `registerChat`. Disposing the Disposable {@link registerChat} returns
   * also unregisters these tools. Aside from that shared disposal, tool
   * registration stays decoupled from chat registration (see
   * {@link registerClientTool}'s own docs) — registering tools this way vs.
   * via a separate {@link registerClientTool}/{@link registerClientTools}
   * call is purely a matter of preference.
   */
  tools?: ClientTool[];
}

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
 * Tools" SIP. Unlike a backend/MCP-server tool, its handler runs in the
 * browser and can read/mutate whatever is currently on screen (e.g. the
 * Dashboard v2 canvas), so it works entirely off local state with no network
 * round trip of its own.
 *
 * Contributed either by the host itself (built-in "core" tools) or by an
 * extension, via {@link registerClientTool} called directly from its own
 * module — same as {@link registerChat}/`commands.registerCommand`.
 */
export interface ClientTool {
  /**
   * Name WITHOUT your extension's own prefix, e.g. `dashboard__do_thing` —
   * when {@link registerClientTool}/{@link registerClientTools} is called
   * from your extension's own module (the normal case: `import { chat }
   * from '@apache-superset/core'` inside your extension), the host
   * automatically qualifies it with your extension id, so it's registered
   * (and addressed in a tool call) as `<your-extension-id>.dashboard__do_thing`.
   * This only applies to calls made through that per-extension binding —
   * host-internal code (this codebase's own "core" tools) isn't
   * extension-scoped, so it manages its own prefix explicitly instead (see
   * {@link registerClientTool}'s own docs).
   */
  name: string;
  /** Describes what the tool does, so the LLM agent knows when to call it. */
  description: string;
  /** JSON Schema for the tool's input, e.g. `{ type: 'object', properties: {} }`. */
  inputSchema: Record<string, unknown>;
  /** Invoked with the model's tool-call arguments; return value is reported back as the tool result. */
  handler: (input: unknown) => Promise<unknown> | unknown;
  /**
   * Optional behavior hints for this tool. See {@link ClientToolAnnotations}.
   * Not required, and nothing in this namespace enforces or acts on them
   * today — the host doesn't yet gate execution (e.g. a confirmation prompt
   * before a destructive call) on either hint. Setting them now means a
   * future consumer that does can rely on tools already carrying this
   * metadata, rather than that being a breaking change to `ClientTool`
   * itself.
   */
  annotations?: ClientToolAnnotations;
}

/**
 * Behavior hints for a {@link ClientTool}, named to match the backend MCP
 * tools' own `readOnlyHint`/`destructiveHint` (`superset/mcp_service/*`'s
 * `@tool(..., annotations=ToolAnnotations(readOnlyHint=..., destructiveHint=...))`,
 * from the official `mcp.types.ToolAnnotations`) — so a tool that exists in
 * both a client and a backend form can describe itself the same way in
 * either one. Like their backend counterparts, these are hints an agent or
 * host UI may use to decide things like whether to ask for confirmation
 * before calling the tool — they are not enforced by this namespace itself.
 */
export interface ClientToolAnnotations {
  /**
   * True if the tool only reads state and never modifies anything visible
   * on screen or persisted — e.g. reading the active dashboard's id.
   * Defaults to `false` (i.e. assume a tool may write) when omitted, same
   * as the backend's `ToolAnnotations.readOnlyHint`.
   */
  readOnlyHint?: boolean;
  /**
   * True if calling the tool may destructively change state (data loss,
   * irreversible UI changes) — only meaningful when {@link readOnlyHint}
   * is falsy. Defaults to `true` (i.e. assume a non-read-only tool may be
   * destructive) when omitted, same as the backend's
   * `ToolAnnotations.destructiveHint`.
   */
  destructiveHint?: boolean;
}

/**
 * Registers a single client-side tool the chat agent can call — mirrors
 * `commands.registerCommand`: a direct, imperative call an extension makes
 * from its own module (typically its `./index` entry), not a declarative
 * `extension.json` pointer the host resolves for you. Called from your
 * extension's own module, your extension id is automatically prepended to
 * `tool.name` (see {@link ClientTool.name}'s own docs) — write just
 * `dashboard__do_thing`, not `my-extension.dashboard__do_thing`. Registering
 * a second tool under the same (already-qualified) name overwrites the
 * first (logged), and disposing the returned Disposable unregisters it.
 *
 * @example
 * ```typescript
 * import { chat } from '@apache-superset/core';
 *
 * chat.registerClientTool({
 *   name: 'dashboard__do_thing',
 *   description: '...',
 *   inputSchema: { type: 'object', properties: {} },
 *   handler: () => ({ success: true }),
 * });
 * ```
 */
export declare function registerClientTool(tool: ClientTool): Disposable;

/**
 * Registers a list of client-side tools in one call — equivalent to calling
 * {@link registerClientTool} once per entry (including its automatic
 * extension-id prefixing), but without writing that loop yourself. Disposing
 * the returned Disposable unregisters every tool in the list.
 *
 * @example
 * ```typescript
 * import { chat } from '@apache-superset/core';
 *
 * chat.registerClientTools(getMyTools(chat));
 * ```
 */
export declare function registerClientTools(tools: ClientTool[]): Disposable;

/**
 * Returns every client-side tool currently available — the host's own
 * built-in ("core") tools plus every loaded extension's
 * {@link registerClientTool} calls. Call this once tools are needed (e.g.
 * when starting a chat turn) rather than caching the result, since it can
 * grow as extensions finish loading.
 *
 * Each entry keeps its `handler`, so this is what a tool-call dispatcher
 * should look tools up from by name.
 *
 * @example
 * ```typescript
 * import { chat } from '@apache-superset/core';
 *
 * const tools = chat.getTools(); // for dispatching a tool call by name
 * ```
 */
export declare function getTools(): ClientTool[];

/**
 * Authoring convenience for building a list of tools to hand to
 * {@link registerClientTools} in one call — `typeof import('.')` here means
 * "the `chat` namespace itself", the same object an extension gets from
 * `import { chat } from '@apache-superset/core'`, so implementing against
 * this type is enough to get the parameter right without hand-writing
 * `(chat: typeof chatApi) => ClientTool[]` again in every extension. Not
 * required — {@link registerClientTools} takes a plain array and doesn't
 * care how the caller assembled it — but grouping a surface's tools behind
 * one factory function (as this codebase's own "core" tools do) keeps a
 * growing list organized.
 *
 * @example
 * ```typescript
 * import type { chat } from '@apache-superset/core';
 *
 * const getMyTools: chat.ClientToolsFactory = (chat) => [
 *   {
 *     name: 'dashboard__my_tool',
 *     description: '...',
 *     inputSchema: { type: 'object', properties: {} },
 *     handler: () => ({ success: true }),
 *   },
 * ];
 *
 * chat.registerClientTools(getMyTools(chat));
 * ```
 */
export type ClientToolsFactory = (chat: typeof import('.')) => ClientTool[];
