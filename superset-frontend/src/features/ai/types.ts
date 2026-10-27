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
 * @fileoverview The AI assistant wire contract and the parsers that produce it.
 *
 * Every shape here arrives as untrusted JSON, either in a REST body or in an
 * SSE frame, so each one has a parser rather than a cast. A missing or
 * wrongly-typed field degrades to a default instead of throwing inside a
 * render: a malformed frame in the middle of a run must not blank a transcript
 * the user has already read.
 */

/**
 * A parsed JSON value. Deliberately not the platform `JsonObject`, whose index
 * signature is `any` and would erase checking on every value read from it.
 */
export type JsonScalar = string | number | boolean | null;
export type JsonData = JsonScalar | JsonData[] | { [key: string]: JsonData };
export type JsonRecord = { [key: string]: JsonData };

export type AiMessageRole = 'user' | 'assistant' | 'system';

// ---------------------------------------------------------------------------
// Panel-facing shapes
//
// The panel keeps one conversation per tab and renders messages from these,
// rather than from the wire shapes below, so a tab that has not been fetched yet
// and one loaded from the server are the same thing to the renderer.
// ---------------------------------------------------------------------------

export interface ChatMessageWithMeta {
  /** The server message uuid once persisted; a local id until then. */
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** Reasoning and the tool log as one block, for the flat rendering used while
   * a run is streaming and there are no structured steps yet. */
  thinking?: string;
  /** Reasoning on its own. Kept apart from `thinking` so the structured view can
   * show it without also repeating the tool log it renders as steps. */
  thoughts?: string;
  /** The page context this turn was given, for the "Context used" step. */
  pageContext?: string;
  /** Steps the assistant took, as persisted on the message. */
  toolCalls?: AiToolCall[];
  /** True while a locally created message has no server uuid, which is what
   * disables feedback on it: `POST feedback` is keyed by message uuid. */
  pending?: boolean;
  /** This user's stored rating, so the thumbs survive a reload. */
  liked?: boolean;
}

export interface ChatTab {
  id: string;
  name: string;
  messages: ChatMessageWithMeta[];
  createdAt: number;
  updatedAt?: number;
  /** Server count used before this tab's messages have been loaded. */
  messageCount?: number;
  /** The server conversation this tab is backed by. */
  threadId?: string;
}

/**
 * A `checkpoint` frame, rendered as a pause in the transcript.
 *
 * `remaining_tasks` and `estimated_duration` are read from the frame's `meta`
 * when present; a checkpoint without them still renders its summary.
 */
export interface CheckpointPayload {
  summary: string;
  remaining_tasks?: string[];
  estimated_duration?: string;
  elapsed_seconds?: number;
  seconds_remaining?: number;
  turn_count?: number;
  turns_remaining?: number;
  /** The step the checkpoint describes, when it carries one. */
  toolCall?: AiToolCall;
  /**
   * Whether this checkpoint is a gate the user must clear, rather than a
   * milestone that scrolls past.
   *
   * Opt-in on purpose, and optional so a caller constructing a milestone does
   * not have to say so. A server that reports every finished tool call as a
   * checkpoint would otherwise pause the stream on each one, leaving the panel
   * showing progress long after the answer had arrived.
   */
  requiresConfirmation?: boolean;
}

/** Detail of the `superset-ai-action` event other features dispatch. */
export interface AIActionPayload {
  /** Sent as the user's message. */
  prompt: string;
  /** Prepended to the conversation as a system directive. */
  systemPrompt?: string;
  /** Name for the conversation the action opens. */
  tabName?: string;
}

export type AIActionEventDetail = AIActionPayload;

/** Value of `stage` on a `thinking` frame. */
export type AiThinkingStage =
  | 'start'
  | 'prompt'
  | 'agent'
  | 'tool'
  | 'reasoning'
  | 'context'
  | 'fallback'
  | 'error'
  | 'usage';

/** An agent profile from `GET /api/v1/ai/agent/`. */
export interface AiAgent {
  key: string;
  name: string;
  description?: string;
  tools: string[];
}

/** A conversation from `/api/v1/ai/thread/`. */
export interface AiThread {
  uuid: string;
  title?: string;
  status?: string;
  agentKey?: string;
  createdOn?: string;
  /** Last activity, which is what the conversation list is ordered and dated by. */
  changedOn?: string;
  messageCount?: number;
}

/**
 * A display whose `kind` the frontend has no renderer for. Tools are free to add
 * kinds, so an unrecognised one degrades to the generic step detail rather than
 * hiding the step.
 */
export interface AiOpaqueDisplay {
  kind?: string;
}

/** The `sql_result` display: what the warehouse ran, and what came back. */
export interface AiSqlResultDisplay {
  kind: 'sql_result';
  /**
   * Which connection ran the statement. Carried so "Run in SQL Lab" opens an
   * editor already pointed at it, rather than relying on SQLLAB_DEFAULT_DBID,
   * which most deployments leave unset.
   */
  databaseId?: number;
  databaseName?: string;
  executedSql?: string;
  /** The statement was clipped for display, so it may not be runnable as-is. */
  executedSqlTruncated: boolean;
  columns: string[];
  rows: JsonRecord[];
  rowCount?: number;
  /** Fewer rows are shown than the query returned. */
  sampleOnly: boolean;
  /** The query result itself was capped before the model saw it. */
  truncated: boolean;
  durationMs?: number;
}

/** Detail a tool attaches to its step for the UI to render. */
export type AiToolDisplay = AiSqlResultDisplay | AiOpaqueDisplay;

export const isSqlResultDisplay = (
  display: AiToolDisplay | undefined,
): display is AiSqlResultDisplay => display?.kind === 'sql_result';

/**
 * One tool invocation. The same shape describes a live `checkpoint` frame and a
 * tool call persisted on a message, so the activity UI has one input whether
 * the run is streaming or was loaded from the server.
 */
export interface AiToolCall {
  name: string;
  ok: boolean;
  durationMs?: number;
  /** The tool clipped its own output before handing it to the model. */
  truncated: boolean;
  /** Arguments the model passed, kept so a surprising result can be explained. */
  args?: JsonRecord;
  /** Recorded tool output, clipped by the backend. */
  output?: string;
  error?: string;
  display?: AiToolDisplay;
}

export interface AiMessage {
  uuid: string;
  role: AiMessageRole;
  content: string;
  createdOn?: string;
  /** Persisted by the backend, which is what lets the activity survive a reload. */
  toolCalls: AiToolCall[];
  /** Model reasoning. Never rendered as part of the answer. */
  thoughts?: string;
  /** What the assistant was told about the user's screen for this turn, as it was
   * sent. Recorded because an answer that looks wrong is usually an answer about
   * a different slice of data than the reader assumed. */
  pageContext?: string;
  error?: string;
  /** The reading user's own rating, or undefined if they have not rated it. Lets
   * the thumbs show a verdict that was left before a reload. */
  liked?: boolean;
}

/** Identifies the run started by `POST /thread/<uuid>/message`. */
export interface AiRunHandle {
  threadUuid: string;
  /** The user message that was just stored. */
  messageUuid: string;
  /** The assistant row the run will write into, created before the run starts. */
  assistantMessageUuid?: string;
  runId: string;
}

export const isDefined = <T>(value: T | undefined): value is T =>
  value !== undefined;

export const isRecord = (value: JsonData | undefined): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Parses a JSON document, returning undefined rather than throwing. */
export function parseJson(raw: string): JsonData | undefined {
  try {
    // JSON.parse is declared as returning `any`; funnel it through `unknown` so
    // nothing downstream inherits an unchecked type.
    const parsed: unknown = JSON.parse(raw);
    return parsed as JsonData;
  } catch {
    return undefined;
  }
}

export const readRecord = (
  from: JsonRecord,
  key: string,
): JsonRecord | undefined => {
  const value = from[key];
  return isRecord(value) ? value : undefined;
};

export const readString = (
  from: JsonRecord,
  key: string,
): string | undefined => {
  const value = from[key];
  return typeof value === 'string' ? value : undefined;
};

export const readNumber = (
  from: JsonRecord,
  key: string,
): number | undefined => {
  const value = from[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
};

/** Absent, null and non-boolean values all read as false. */
export const readBoolean = (from: JsonRecord, key: string): boolean =>
  from[key] === true;

/**
 * A boolean that keeps the difference between false and absent.
 *
 * Needed where a field is genuinely tri-state — a rating is up, down, or not
 * given — and collapsing absent to false would render an unrated message as a
 * thumbs-down.
 */
export const readOptionalBoolean = (
  from: JsonRecord,
  key: string,
): boolean | undefined =>
  typeof from[key] === 'boolean' ? (from[key] as boolean) : undefined;

const readArray = (from: JsonRecord, key: string): JsonData[] => {
  const value = from[key];
  return Array.isArray(value) ? value : [];
};

export const readStringArray = (from: JsonRecord, key: string): string[] =>
  readArray(from, key).filter(
    (item): item is string => typeof item === 'string',
  );

export const readRecordArray = (from: JsonRecord, key: string): JsonRecord[] =>
  readArray(from, key).filter(isRecord);

const MESSAGE_ROLES: readonly string[] = ['user', 'assistant', 'system'];

const isMessageRole = (value: string | undefined): value is AiMessageRole =>
  value !== undefined && MESSAGE_ROLES.includes(value);

export function parseToolDisplay(
  value: JsonData | undefined,
): AiToolDisplay | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const kind = readString(value, 'kind');
  if (kind !== 'sql_result') {
    return { kind };
  }
  return {
    kind: 'sql_result',
    databaseName: readString(value, 'database_name'),
    // `executed_sql` is what the SQL tool writes. `sql` is accepted as well
    // because the published event contract names the field that way, and a
    // step whose SQL is not shown defeats the point of the activity block.
    executedSql: readString(value, 'executed_sql') ?? readString(value, 'sql'),
    databaseId: readNumber(value, 'database_id'),
    executedSqlTruncated: readBoolean(value, 'executed_sql_truncated'),
    columns: readStringArray(value, 'columns'),
    rows: readRecordArray(value, 'rows'),
    rowCount: readNumber(value, 'row_count'),
    sampleOnly: readBoolean(value, 'sample_only'),
    truncated: readBoolean(value, 'truncated'),
    durationMs: readNumber(value, 'duration_ms'),
  };
}

/**
 * Parses one tool invocation.
 *
 * Accepts both spellings of the name: a persisted record uses `name`, while the
 * `meta` of a live `checkpoint` frame uses `tool_name`.
 */
export function parseToolCall(
  value: JsonData | undefined,
): AiToolCall | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const name = readString(value, 'name') ?? readString(value, 'tool_name');
  if (!name) {
    return undefined;
  }
  return {
    name,
    // A record without `ok` is treated as a success: painting a completed step
    // red because a field is missing is the worse failure mode.
    ok: value.ok !== false,
    durationMs: readNumber(value, 'duration_ms'),
    truncated: readBoolean(value, 'truncated'),
    args: readRecord(value, 'arguments'),
    output: readString(value, 'output'),
    error: readString(value, 'error'),
    display: parseToolDisplay(value.display),
  };
}

export function parseMessage(
  value: JsonData | undefined,
): AiMessage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const uuid = readString(value, 'uuid');
  const role = readString(value, 'role');
  if (!uuid || !isMessageRole(role)) {
    return undefined;
  }
  // Tool calls are stored in the message's `extra` blob. A serializer that
  // hoists them to the top level is read too, because which of the two ships is
  // not pinned by the API yet.
  const extra = readRecord(value, 'extra') ?? {};
  const toolCallSource = value.tool_calls === undefined ? extra : value;
  return {
    uuid,
    role,
    content: readString(value, 'content') ?? '',
    createdOn: readString(value, 'created_on'),
    toolCalls: readRecordArray(toolCallSource, 'tool_calls')
      .map(parseToolCall)
      .filter(isDefined),
    thoughts: readString(value, 'thoughts') ?? readString(extra, 'thoughts'),
    pageContext:
      readString(value, 'page_context') ?? readString(extra, 'page_context'),
    error: readString(value, 'error') ?? readString(extra, 'error'),
    liked: readOptionalBoolean(value, 'liked'),
  };
}

export function parseThread(value: JsonData | undefined): AiThread | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const uuid = readString(value, 'uuid');
  if (!uuid) {
    return undefined;
  }
  return {
    uuid,
    title: readString(value, 'title'),
    status: readString(value, 'status'),
    agentKey: readString(value, 'agent_key'),
    createdOn: readString(value, 'created_on'),
    changedOn: readString(value, 'changed_on'),
    messageCount: readNumber(value, 'message_count'),
  };
}

export function parseAgent(value: JsonData | undefined): AiAgent | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const key = readString(value, 'key');
  if (!key) {
    return undefined;
  }
  return {
    key,
    name: readString(value, 'name') ?? key,
    description: readString(value, 'description'),
    tools: readStringArray(value, 'tools'),
  };
}

/**
 * Parses a `checkpoint` frame.
 *
 * A frame with no usable summary still yields a checkpoint: the panel pauses on
 * it, and pausing with no explanation is better than dropping the pause and
 * letting the run appear to have finished.
 */
export function parseCheckpoint(
  value: JsonData | undefined,
): CheckpointPayload {
  const body = isRecord(value) ? value : {};
  const meta = readRecord(body, 'meta') ?? {};
  return {
    summary: readString(body, 'summary') ?? 'Preparing next steps...',
    remaining_tasks: readStringArray(meta, 'remaining_tasks').length
      ? readStringArray(meta, 'remaining_tasks')
      : undefined,
    estimated_duration: readString(meta, 'estimated_duration'),
    elapsed_seconds: readNumber(meta, 'elapsed_seconds'),
    seconds_remaining: readNumber(meta, 'seconds_remaining'),
    turn_count: readNumber(meta, 'turn_count'),
    turns_remaining: readNumber(meta, 'turns_remaining'),
    toolCall: parseToolCall(body.meta),
    requiresConfirmation: readBoolean(meta, 'requires_confirmation'),
  };
}
