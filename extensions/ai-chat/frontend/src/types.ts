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
 * Protocol types shared with the AI chat gateway (superset/ai_chat).
 */
import { chat, navigation } from '@apache-superset/core';

export type Page = ReturnType<typeof navigation.getPage>;

/** Floating bubble vs docked panel; the host owns which one is active */
export type DisplayMode = ReturnType<typeof chat.getDisplayMode>;

export type ToolClassification =
  'read_only' | 'mutating' | 'destructive' | 'unknown';

/**
 * How much of the tool surface the operator gates behind an approval.
 * Reported for display only — which calls are actually gated is decided
 * server-side, and reaches the panel as `tool.approval_required` events.
 */
export type ToolApprovalMode = 'disabled' | 'mutations_only' | 'all_tools';

export interface ProtocolToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** An image attached to a user message, base64-encoded by the browser */
export interface ProtocolImage {
  media_type: string;
  data: string;
  name?: string;
}

export interface ProtocolMessage {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: ProtocolToolCall[];
  tool_call_id?: string;
  name?: string;
  /** Only honored on a user message; the gateway drops any others */
  images?: ProtocolImage[];
}

/** What the transcript shows about an attachment, without its file text */
export interface AttachmentRef {
  name: string;
  /** Text files only: the file was longer than the per-file limit */
  truncated?: boolean;
  /** Images only: data URL rendered as a thumbnail, never persisted */
  preview?: string;
}

export interface ResourceContext {
  kind: 'dashboard' | 'chart' | 'dataset';
  id_or_slug: string;
  /**
   * Human-readable name resolved from the REST API. Absent until it
   * resolves; the gateway treats it as untrusted, user-authored text.
   */
  name?: string;
}

export interface PageContext {
  page: string;
  resource?: ResourceContext;
  /**
   * Objects the user attached by dragging them into the chat. Unlike
   * `resource`, which follows navigation, these stay until removed.
   */
  references?: ResourceContext[];
}

export interface MessageCompletedEvent {
  type: 'message.completed';
  id: string;
  content: string;
}

export interface ToolRunningEvent {
  type: 'tool.running';
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
}

export interface ToolCompletedEvent {
  type: 'tool.completed';
  id: string;
  tool: string;
  result: string;
  truncated: boolean;
}

export interface ToolFailedEvent {
  type: 'tool.failed';
  id: string;
  tool: string;
  error: string;
}

export interface ToolApprovalRequiredEvent {
  type: 'tool.approval_required';
  id: string;
  tool: string;
  tool_title: string | null;
  arguments: Record<string, unknown>;
  classification: ToolClassification;
  approval_id: string;
  expires_at: string;
  reversible: boolean;
  warnings: string[];
}

export interface ToolRejectedEvent {
  type: 'tool.rejected';
  id: string;
  tool: string;
}

export interface RequestCompletedEvent {
  type: 'request.completed';
  usage?: Record<string, number>;
}

export interface RequestFailedEvent {
  type: 'request.failed';
  error_code: string;
  message: string;
}

export type ChatEvent =
  | MessageCompletedEvent
  | ToolRunningEvent
  | ToolCompletedEvent
  | ToolFailedEvent
  | ToolApprovalRequiredEvent
  | ToolRejectedEvent
  | RequestCompletedEvent
  | RequestFailedEvent;

export interface ChatTurnResult {
  conversation_id: string;
  events: ChatEvent[];
}

export interface AiChatToolInfo {
  name: string;
  title: string | null;
  classification: ToolClassification;
}

export interface AiChatConfig {
  enabled: boolean;
  provider: string | null;
  provider_configured: boolean;
  mcp_available: boolean;
  /** Informational only; never consulted before rendering approval controls */
  tool_approval_mode: ToolApprovalMode;
  tools: AiChatToolInfo[];
  limits: {
    max_messages_per_request: number;
    max_input_chars: number;
  };
}

export type ToolStatus =
  'running' | 'succeeded' | 'failed' | 'awaiting_approval' | 'rejected';

export type DisplayItem =
  | {
      kind: 'message';
      id: string;
      role: 'user' | 'assistant';
      content: string;
      /** File names shown in the transcript; their text lives in history */
      attachments?: AttachmentRef[];
      /**
       * Objects that were attached when the turn was sent. A snapshot, not a
       * view of what is attached now: the transcript records the context each
       * question actually carried, and references come and go between turns.
       */
      references?: ResourceContext[];
    }
  | {
      kind: 'tool';
      id: string;
      tool: string;
      title: string | null;
      status: ToolStatus;
      arguments: Record<string, unknown>;
      classification?: ToolClassification;
      result?: string;
      truncated?: boolean;
      error?: string;
    }
  | {
      kind: 'note';
      id: string;
      content: string;
      /**
       * Navigation notes only: link back to where the conversation was
       * happening. Consecutive navigations collapse into a single note, so
       * this points at the origin, not the last page passed through.
       */
      back?: NoteBackLink;
    };

export interface NoteBackLink {
  /** Same-origin path with query, so notes can only link within Superset */
  href: string;
  label: string;
}

/**
 * Collapse-all instruction from the panel header. `seq` changes on every
 * click so a panel can tell a fresh instruction from a re-render. Panels
 * mounted afterwards ignore it, keeping new replies expanded.
 */
export interface FoldSignal {
  seq: number;
  collapsed: boolean;
}

export interface PendingApproval {
  toolCallId: string;
  tool: string;
  toolTitle: string | null;
  arguments: Record<string, unknown>;
  classification: ToolClassification;
  approvalId: string;
  expiresAt: string;
  reversible: boolean;
  warnings: string[];
}
