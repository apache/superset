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
 * Conversation state and the reducer that applies gateway protocol events.
 *
 * The gateway is stateless, so the client replays trimmed history on every
 * turn. History is rebuilt from events in the shapes the gateway builds
 * internally: an assistant message carrying tool_calls, then role="tool"
 * results.
 */
import { isCollapsible } from '../utils/messageTitle';
import type {
  AttachmentRef,
  ChatEvent,
  DisplayItem,
  NoteBackLink,
  PendingApproval,
  ProtocolImage,
  ProtocolMessage,
  ResourceContext,
  ToolStatus,
} from '../types';

export const MAX_HISTORY_MESSAGES = 60;
export const MAX_PERSISTED_CHARS = 200_000;

// Mirrors the gateway's rejection tool result so replayed history matches
// what the model saw during the rejected turn
export const REJECTION_TOOL_RESULT =
  'The user rejected this action. It was NOT executed. Do not retry it ' +
  'unless the user explicitly asks again; offer an alternative instead.';

export interface ConversationState {
  conversationId: string;
  items: DisplayItem[];
  history: ProtocolMessage[];
  pending: PendingApproval | null;
  status: 'idle' | 'sending';
  error: string | null;
  startedPage: string | null;
}

export type ConversationAction =
  | { type: 'hydrate'; state: ConversationState }
  | {
      type: 'user_message';
      id: string;
      /** What the user typed, shown in the transcript */
      content: string;
      /**
       * What the model receives: the typed text plus any attached file
       * blocks. Defaults to `content` when nothing was attached.
       */
      sent?: string;
      attachments?: AttachmentRef[];
      /** Dropped objects this turn carried, recorded beside the message */
      references?: ResourceContext[];
      images?: ProtocolImage[];
    }
  | { type: 'events'; events: ChatEvent[] }
  | { type: 'request_error'; message: string }
  | { type: 'cancelled'; noteId: string; note: string }
  | { type: 'approval_submitted' }
  | {
      type: 'page_changed';
      noteId: string;
      note: string;
      back?: NoteBackLink;
      /** Where the user landed, used to detect a return to the origin */
      href: string;
    }
  | { type: 'clear_error' }
  | { type: 'reset'; conversationId: string; page: string | null };

export function generateConversationId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `conv_${random}`.slice(0, 64);
}

/** Client-side id for a transcript item (message, note, tool card) */
export function itemId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function newConversation(page: string | null): ConversationState {
  return {
    conversationId: generateConversationId(),
    items: [],
    history: [],
    pending: null,
    status: 'idle',
    error: null,
    startedPage: page,
  };
}

/**
 * Whether the transcript renders a reply long enough to fold. Expand-all
 * reopens replies and nothing else, so this is what that direction acts on.
 */
export function hasCollapsibleAnswers(items: DisplayItem[]): boolean {
  return items.some(
    item =>
      item.kind === 'message' &&
      item.role === 'assistant' &&
      isCollapsible(item.content),
  );
}

/**
 * Whether the transcript renders any panel collapse-all can close. Tool cards
 * are always panels; user messages and notes never are.
 */
export function hasCollapsiblePanels(items: DisplayItem[]): boolean {
  return (
    hasCollapsibleAnswers(items) || items.some(item => item.kind === 'tool')
  );
}

/** Tool cards worth showing even when tool activity is hidden */
const DEMANDS_ATTENTION: ToolStatus[] = [
  'awaiting_approval',
  'rejected',
  'failed',
];

/**
 * The transcript as rendered.
 *
 * A tool card reports what the assistant did so the user can supervise it.
 * Where nothing is gated there is nothing to supervise, so routine calls are
 * dropped and the transcript reads as a conversation. A call that failed, or
 * that the gateway gated anyway, stays: it explains a thin answer or asks for
 * a decision.
 *
 * Only the rendering is affected. The reducer keeps every card, because the
 * history replayed to the model is built from the same events.
 */
export function visibleItems(
  items: DisplayItem[],
  showToolActivity: boolean,
): DisplayItem[] {
  if (showToolActivity) return items;
  return items.filter(
    item => item.kind !== 'tool' || DEMANDS_ATTENTION.includes(item.status),
  );
}

/** Keeps history within limits and starting at a user message */
export function trimHistory(history: ProtocolMessage[]): ProtocolMessage[] {
  const trimmed = history.slice(-MAX_HISTORY_MESSAGES);
  while (trimmed.length && trimmed[0].role !== 'user') {
    trimmed.shift();
  }
  return trimmed;
}

function upsertToolItem(
  items: DisplayItem[],
  id: string,
  patch: Partial<Extract<DisplayItem, { kind: 'tool' }>> & {
    tool?: string;
  },
): DisplayItem[] {
  const index = items.findIndex(item => item.kind === 'tool' && item.id === id);
  if (index >= 0) {
    const existing = items[index] as Extract<DisplayItem, { kind: 'tool' }>;
    const next = [...items];
    next[index] = { ...existing, ...patch };
    return next;
  }
  return [
    ...items,
    {
      kind: 'tool',
      id,
      tool: patch.tool || 'tool',
      title: patch.title ?? null,
      status: patch.status || 'running',
      arguments: patch.arguments || {},
      ...patch,
    },
  ];
}

/**
 * Appends the assistant tool call and its result to history. A tool call
 * following a plain assistant message from the same turn is merged into that
 * message, rebuilding the single message the gateway produced, since some
 * providers reject consecutive assistant messages.
 */
function pushToolExchange(
  history: ProtocolMessage[],
  toolCallId: string,
  tool: string,
  args: Record<string, unknown>,
  resultContent: string,
): ProtocolMessage[] {
  const next = [...history];
  const last = next[next.length - 1];
  const call = { id: toolCallId, name: tool, arguments: args };
  if (last && last.role === 'assistant' && !last.tool_calls?.length) {
    next[next.length - 1] = { ...last, tool_calls: [call] };
  } else {
    next.push({ role: 'assistant', content: '', tool_calls: [call] });
  }
  next.push({
    role: 'tool',
    tool_call_id: toolCallId,
    name: tool,
    content: resultContent,
  });
  return next;
}

function findToolArguments(
  items: DisplayItem[],
  id: string,
): Record<string, unknown> {
  const item = items.find(entry => entry.kind === 'tool' && entry.id === id) as
    Extract<DisplayItem, { kind: 'tool' }> | undefined;
  return item?.arguments || {};
}

function applyEvent(
  state: ConversationState,
  event: ChatEvent,
): ConversationState {
  switch (event.type) {
    case 'message.completed':
      return {
        ...state,
        items: [
          ...state.items,
          {
            kind: 'message',
            id: event.id,
            role: 'assistant',
            content: event.content,
          },
        ],
        history: [
          ...state.history,
          { role: 'assistant', content: event.content },
        ],
      };
    case 'tool.running':
      return {
        ...state,
        items: upsertToolItem(state.items, event.id, {
          tool: event.tool,
          status: 'running',
          arguments: event.arguments,
        }),
      };
    case 'tool.completed':
      return {
        ...state,
        items: upsertToolItem(state.items, event.id, {
          tool: event.tool,
          status: 'succeeded',
          result: event.result,
          truncated: event.truncated,
        }),
        history: pushToolExchange(
          state.history,
          event.id,
          event.tool,
          findToolArguments(
            upsertToolItem(state.items, event.id, { tool: event.tool }),
            event.id,
          ),
          event.result,
        ),
      };
    case 'tool.failed':
      return {
        ...state,
        items: upsertToolItem(state.items, event.id, {
          tool: event.tool,
          status: 'failed',
          error: event.error,
        }),
        history: pushToolExchange(
          state.history,
          event.id,
          event.tool,
          findToolArguments(state.items, event.id),
          `Error: ${event.error}`,
        ),
      };
    case 'tool.approval_required':
      return {
        ...state,
        items: upsertToolItem(state.items, event.id, {
          tool: event.tool,
          title: event.tool_title,
          status: 'awaiting_approval',
          arguments: event.arguments,
          classification: event.classification,
        }),
        pending: {
          toolCallId: event.id,
          tool: event.tool,
          toolTitle: event.tool_title,
          arguments: event.arguments,
          classification: event.classification,
          approvalId: event.approval_id,
          expiresAt: event.expires_at,
          reversible: event.reversible,
          warnings: event.warnings,
        },
      };
    case 'tool.rejected':
      return {
        ...state,
        items: upsertToolItem(state.items, event.id, {
          tool: event.tool,
          status: 'rejected',
        }),
        pending: null,
        history: pushToolExchange(
          state.history,
          event.id,
          event.tool,
          findToolArguments(state.items, event.id),
          REJECTION_TOOL_RESULT,
        ),
      };
    case 'request.completed':
      return { ...state, status: 'idle' };
    case 'request.failed':
      return { ...state, status: 'idle', error: event.message };
    default:
      return state;
  }
}

export function conversationReducer(
  state: ConversationState,
  action: ConversationAction,
): ConversationState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'user_message':
      return {
        ...state,
        status: 'sending',
        error: null,
        items: [
          ...state.items,
          {
            kind: 'message',
            id: action.id,
            role: 'user',
            content: action.content,
            ...(action.attachments?.length
              ? { attachments: action.attachments }
              : {}),
            ...(action.references?.length
              ? { references: action.references }
              : {}),
          },
        ],
        history: trimHistory([
          ...state.history,
          {
            role: 'user',
            content: action.sent ?? action.content,
            ...(action.images?.length ? { images: action.images } : {}),
          },
        ]),
      };
    case 'events': {
      let next = action.events.reduce(applyEvent, state);
      // A turn paused for approval emits no request.completed, so clear
      // "sending" here to let the user decide
      if (next.pending && next.status === 'sending') {
        next = { ...next, status: 'idle' };
      }
      return { ...next, history: trimHistory(next.history) };
    }
    case 'approval_submitted':
      return { ...state, status: 'sending', error: null, pending: null };
    case 'request_error':
      return { ...state, status: 'idle', error: action.message };
    case 'cancelled':
      return {
        ...state,
        status: 'idle',
        items: [
          ...state.items,
          { kind: 'note', id: action.noteId, content: action.note },
        ],
      };
    case 'page_changed': {
      // A navigation note covers the gap between the last message and the
      // current page. Navigating again without saying anything widens that
      // gap, so consecutive notes collapse into one that keeps pointing at
      // the page the conversation happened on
      const last = state.items[state.items.length - 1];
      const previous = last?.kind === 'note' && last.back ? last : null;
      const origin = previous ? previous.back : action.back;

      if (origin && origin.href === action.href) {
        // Back where the messages were, so the note has nothing left to say
        return previous ? { ...state, items: state.items.slice(0, -1) } : state;
      }

      const note: DisplayItem = {
        kind: 'note',
        // Reusing the id keeps the collapsed note in place instead of
        // remounting it on every navigation
        id: previous ? previous.id : action.noteId,
        content: action.note,
        back: origin,
      };
      return {
        ...state,
        items: previous
          ? [...state.items.slice(0, -1), note]
          : [...state.items, note],
      };
    }
    case 'clear_error':
      return { ...state, error: null };
    case 'reset':
      return {
        ...newConversation(action.page),
        conversationId: action.conversationId,
      };
    default:
      return state;
  }
}

export interface PersistedConversation {
  conversationId: string;
  items: DisplayItem[];
  history: ProtocolMessage[];
  startedPage: string | null;
}

/**
 * Drops image payloads before a conversation is written to storage. A single
 * screenshot exceeds the persistence budget and would evict the conversation
 * around it, so a reloaded conversation keeps the message and the image name
 * but neither the thumbnail nor the image the model saw.
 */
function withoutImages(state: ConversationState): ConversationState {
  return {
    ...state,
    items: state.items.map(item =>
      item.kind === 'message' && item.attachments?.length
        ? {
            ...item,
            attachments: item.attachments.map(({ preview, ...ref }) => ref),
          }
        : item,
    ),
    history: state.history.map(({ images, ...message }) => message),
  };
}

/** Serializable snapshot, trimmed to the persistence budget */
export function toPersisted(state: ConversationState): PersistedConversation {
  let { items, history } = withoutImages(state);
  const snapshot = () => ({
    conversationId: state.conversationId,
    items,
    history,
    startedPage: state.startedPage,
  });
  while (
    JSON.stringify(snapshot()).length > MAX_PERSISTED_CHARS &&
    (items.length > 1 || history.length > 1)
  ) {
    items = items.slice(1);
    history = trimHistory(history.slice(1));
  }
  return snapshot();
}

export function fromPersisted(
  persisted: PersistedConversation,
): ConversationState {
  return {
    conversationId: persisted.conversationId,
    items: persisted.items,
    history: persisted.history,
    // Approvals are never persisted: a reload abandons the proposal and the
    // approval expires server-side
    pending: null,
    status: 'idle',
    error: null,
    startedPage: persisted.startedPage,
  };
}
