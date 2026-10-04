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
 * @fileoverview The streaming client for one assistant turn.
 *
 * A turn is two requests: `POST /thread/<uuid>/message` accepts the message and
 * names a run, then `GET /thread/<uuid>/stream?run_id=` delivers that run's
 * frames. The stream is read with `fetch` and parsed here rather than handed to
 * `EventSource`, for one reason that matters: a `checkpoint` frame has to be able
 * to stop the reader while the user decides whether to continue, and
 * `EventSource` dispatches events on its own schedule with no way to hold them.
 * Reading the body ourselves also gives `AbortController` cancellation and lets
 * the parser be tested without a browser.
 */

import { SupersetClient, getClientErrorObject } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { ensureAppRoot } from 'src/utils/navigationUtils';
import {
  type AiAgent,
  type AiToolCall,
  type CheckpointPayload,
  type JsonData,
  type JsonRecord,
  isDefined,
  isRecord,
  isSqlResultDisplay,
  parseAgent,
  parseCheckpoint,
  parseJson,
  readBoolean,
  readRecord,
  readRecordArray,
  readString,
} from '../types';

export const AI_ROOT = '/api/v1/ai';
export const AGENTS_ENDPOINT = `${AI_ROOT}/agent/`;
export const THREAD_ENDPOINT = `${AI_ROOT}/thread/`;
export const FEEDBACK_ENDPOINT = `${AI_ROOT}/feedback`;
export const SUGGESTED_PROMPTS_ENDPOINT = `${AI_ROOT}/suggested-prompts`;

/**
 * Selecting no profile is a valid choice: the backend then uses the deployment's
 * default. The key is a sentinel rather than `undefined` so it can round-trip
 * through the agent `<Select>` and localStorage.
 */
export const DEFAULT_AGENT_KEY = 'default';

export const DEFAULT_CHAT_AGENT: AiAgent = {
  key: DEFAULT_AGENT_KEY,
  name: t('Default'),
  tools: [],
};

/** Where the selected profile is remembered between sessions. */
export const AGENT_STORAGE_KEY = 'superset-chat-agent';

/**
 * Close the reader before the server's own 900-second ceiling so the failure is
 * reported as a timeout here rather than as a truncated body.
 */
export const STREAM_TIMEOUT_MS = 600_000;

export class ChatStreamEventError extends Error {}

export class ChatRequestAbortedError extends Error {}

export class ChatStreamTimeoutError extends Error {
  runId: string;

  constructor(runId: string) {
    super('Stream timed out');
    this.name = 'ChatStreamTimeoutError';
    this.runId = runId;
  }
}

export const normalizeChatAgents = (agents: AiAgent[]): AiAgent[] => {
  const seen = new Set<string>();
  const result: AiAgent[] = [];

  const addAgent = (agent: AiAgent) => {
    if (!agent.key || seen.has(agent.key)) {
      return;
    }
    seen.add(agent.key);
    result.push(agent);
  };

  const defaultAgent =
    agents.find(agent => agent.key === DEFAULT_AGENT_KEY) ?? DEFAULT_CHAT_AGENT;
  addAgent(defaultAgent);

  agents.forEach(agent => {
    if (agent.key !== DEFAULT_AGENT_KEY) {
      addAgent(agent);
    }
  });

  return result.length > 0 ? result : [DEFAULT_CHAT_AGENT];
};

export const loadStoredAgentKey = (storageKey: string): string => {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored?.trim() ? stored.trim() : DEFAULT_AGENT_KEY;
  } catch {
    return DEFAULT_AGENT_KEY;
  }
};

/**
 * `SupersetClient` types a parsed body with an `any`-valued index signature. It
 * is narrowed once, here, so every field read goes through a checked helper.
 */
const bodyOf = (json: { [key: string]: unknown }): JsonRecord =>
  json as JsonRecord;

export const describeRequestError = async (
  caught: unknown,
  fallback: string,
): Promise<string> => {
  // SupersetClient rejects with the Response for an HTTP error, which is where
  // the API's own message lives; a transport failure rejects with an Error.
  if (caught instanceof Response || typeof caught === 'string') {
    const clientError = await getClientErrorObject(caught);
    return clientError.message || clientError.error || fallback;
  }
  if (caught instanceof Error) {
    return caught.message || fallback;
  }
  return fallback;
};

/**
 * Agent profiles the user may pick.
 *
 * An empty list is not an error: the panel hides the selector and the backend
 * chooses, so a deployment that exposes no profiles still works.
 */
export const fetchAgents = async (): Promise<AiAgent[]> => {
  const { json } = await SupersetClient.get({ endpoint: AGENTS_ENDPOINT });
  return readRecordArray(bodyOf(json), 'result')
    .map(parseAgent)
    .filter(isDefined);
};

// ---------------------------------------------------------------------------
// Server-sent event parsing
// ---------------------------------------------------------------------------

interface SseEvent {
  event: string;
  data: string;
}

interface ParseResult {
  events: SseEvent[];
  remainder: string;
}

/**
 * Splits a buffer into whole frames, returning the trailing partial frame so the
 * caller can prepend it to the next chunk. A frame split across two TCP reads
 * must not be dropped.
 */
export const parseSseEvents = (buffer: string): ParseResult => {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const chunks = normalized.split('\n\n');
  const remainder = chunks.pop() ?? '';
  const events: SseEvent[] = [];

  chunks.forEach(chunk => {
    const lines = chunk.split('\n');
    let eventName = '';
    const dataLines: string[] = [];

    lines.forEach(line => {
      // A line starting with ':' is a comment, which is what keep-alives are.
      if (!line || line.startsWith(':')) {
        return;
      }
      if (line.startsWith('event:')) {
        eventName = line.slice('event:'.length).trim();
        return;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim());
      }
    });

    if (dataLines.length > 0) {
      events.push({ event: eventName, data: dataLines.join('\n') });
    }
  });

  return { events, remainder };
};

const frameBody = (data: string): JsonRecord => {
  const parsed = parseJson(data);
  return isRecord(parsed) ? parsed : {};
};

/**
 * Renders a `thinking` frame as one line of the tool log.
 *
 * Frames vary in which of stage, message and meta they carry, so every shape the
 * backend emits collapses to a single line here instead of each caller guessing.
 */
export const extractThinkingText = (payload: JsonData): string | null => {
  if (typeof payload === 'string') {
    return payload.trim() || null;
  }
  if (!isRecord(payload)) {
    return null;
  }
  const delta = readString(payload, 'delta');
  if (delta?.trim()) {
    return delta;
  }
  const content = readString(payload, 'content');
  if (content?.trim()) {
    return content.trim();
  }
  const stage = readString(payload, 'stage')?.trim() ?? '';
  const message = readString(payload, 'message')?.trim() ?? '';
  const meta = readRecord(payload, 'meta');
  let metaText = '';
  if (meta) {
    const primary = readString(meta, 'tool_name') ?? readString(meta, 'name');
    const duration = meta.duration_ms;
    metaText = primary
      ? `${primary}${typeof duration === 'number' ? ` (${duration}ms)` : ''}`
      : '';
  }
  // The stage is a machine label ("start", "tool", "fallback") and the message
  // is already written for a reader, so only the message is shown. Including the
  // stage produced lines like "start - Working on your question", which reads as
  // debug output leaking into the panel.
  const parts = [message, metaText].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' — ');
  }
  // A stage with no message is still worth a line rather than nothing, but it is
  // titled so it does not look like a raw enum.
  return stage ? stage.replace(/_/g, ' ') : null;
};

/** Cell values are rendered inline in a markdown table, so pipes must not leak. */
const formatCell = (value: JsonData | undefined): string => {
  if (value === undefined || value === null) {
    return '';
  }
  const text =
    typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
};

/**
 * Renders one persisted tool call as markdown.
 *
 * SQL is emitted as a fenced ```sql block and result rows as a GFM table so the
 * step is rendered by the same markdown components as the answer — which is
 * where highlighting, "Run in SQL Lab" and the collapse behaviour already live.
 */
export const describeToolCall = (call: AiToolCall): string => {
  const duration =
    call.durationMs === undefined ? '' : ` _(${call.durationMs}ms)_`;
  const outcome = call.ok ? '' : ' — failed';
  const lines: string[] = [`**${call.name}**${outcome}${duration}`];

  if (call.error) {
    lines.push('', call.error);
  }

  const { display } = call;
  if (isSqlResultDisplay(display)) {
    if (display.executedSql) {
      const fence = display.executedSqlTruncated
        ? t('Statement clipped for display.')
        : '';
      // The database id goes in the fence info string. "Run in SQL Lab" reads it
      // from there, and without it the action falls back to
      // SQLLAB_DEFAULT_DBID — which most deployments never set, so the button
      // opened an editor with no connection selected. The tool already knows
      // which database it queried, so carry that through.
      const info =
        display.databaseId === undefined ? 'sql' : `sql ${display.databaseId}`;
      lines.push('', `\`\`\`${info}`, display.executedSql, '```');
      if (fence) {
        lines.push(`_${fence}_`);
      }
    }
    if (display.columns.length > 0 && display.rows.length > 0) {
      lines.push(
        '',
        `| ${display.columns.join(' | ')} |`,
        `| ${display.columns.map(() => '---').join(' | ')} |`,
        ...display.rows.map(
          row =>
            `| ${display.columns
              .map(column => formatCell(row[column]))
              .join(' | ')} |`,
        ),
      );
    }
    const notes: string[] = [];
    if (display.rowCount !== undefined) {
      notes.push(t('%s row(s)', String(display.rowCount)));
    }
    if (display.sampleOnly) {
      notes.push(t('sample only'));
    }
    if (display.truncated) {
      notes.push(t('result truncated'));
    }
    if (notes.length > 0) {
      lines.push('', `_${notes.join(' · ')}_`);
    }
  } else if (call.output) {
    lines.push('', call.output);
  }

  return lines.join('\n');
};

export const describeToolCalls = (calls: AiToolCall[]): string =>
  calls.map(describeToolCall).join('\n\n');

// ---------------------------------------------------------------------------
// Starting and reading a run
// ---------------------------------------------------------------------------

export interface StartRunOptions {
  threadUuid: string;
  content: string;
  /** Idempotency key: re-posting it returns the original message. */
  requestId: string;
  agentKey?: string;
  /** What the user is looking at; see `usePageContext`. */
  pageContext?: Record<string, unknown>;
}

export interface RunHandle {
  threadUuid: string;
  /** The stored user message. */
  messageUuid: string;
  /** The assistant row the run writes into, created before the run starts. */
  assistantMessageUuid?: string;
  runId: string;
}

export const startRun = async ({
  threadUuid,
  content,
  requestId,
  agentKey,
  pageContext,
}: StartRunOptions): Promise<RunHandle> => {
  const { json } = await SupersetClient.post({
    endpoint: `${THREAD_ENDPOINT}${encodeURIComponent(threadUuid)}/message`,
    jsonPayload: {
      content,
      request_id: requestId,
      // The sentinel is a local convention, not a profile the backend knows.
      ...(agentKey && agentKey !== DEFAULT_AGENT_KEY
        ? { agent_key: agentKey }
        : {}),
      ...(pageContext ? { page_context: pageContext } : {}),
    },
  });
  const result = readRecord(bodyOf(json), 'result') ?? {};
  const messageUuid = readString(result, 'message_uuid');
  const runId = readString(result, 'run_id');
  if (!messageUuid || !runId) {
    throw new Error('The assistant did not start a run.');
  }
  return {
    threadUuid,
    messageUuid,
    runId,
    assistantMessageUuid: readString(result, 'assistant_message_uuid'),
  };
};

/**
 * The stream endpoint, prefixed for the deployment root.
 *
 * Built with `ensureAppRoot` rather than by concatenating `applicationRoot()`:
 * the stream is read with native `fetch` rather than `SupersetClient`, so the
 * prefix has to be applied here, and that helper is the sanctioned way to do it
 * exactly once.
 */
export const streamUrl = (threadUuid: string, runId: string): string =>
  ensureAppRoot(
    `${THREAD_ENDPOINT}${encodeURIComponent(threadUuid)}/stream` +
      `?run_id=${encodeURIComponent(runId)}`,
  );

export interface StreamRunOptions {
  threadUuid: string;
  runId: string;
  signal?: AbortSignal;
  /** The assistant message the run writes into, from the `session` frame. */
  onSession?: (messageUuid: string) => void;
  /** One line of the tool log. */
  onThinking?: (line: string) => void;
  /** A chunk of model reasoning. Never part of the answer. */
  onThoughts?: (delta: string) => void;
  /** A chunk of the answer. */
  onAssistantDelta?: (delta: string) => void;
  /** The authoritative replacement from the final frame. */
  onAssistantFinal?: (content: string) => void;
  /**
   * A pause. The reader stops until the returned promise resolves, which is what
   * makes the checkpoint a gate the user can act on rather than a notice that
   * scrolls past. Frames the server keeps producing buffer in the network layer
   * and are processed on resume.
   */
  onCheckpoint?: (checkpoint: CheckpointPayload) => Promise<void>;
  /** Overridable for tests. */
  streamTimeoutMs?: number;
}

export interface StreamResult {
  /** The authoritative answer from the `final` frame. */
  content: string;
  cancelled: boolean;
}

/**
 * Reads one run to completion.
 *
 * `done` is always the last frame and its `ok` decides the outcome, so a run that
 * dies without a `final` frame is reported as a failure rather than as an empty
 * answer.
 */
const isAbortError = (caught: unknown): boolean =>
  (caught instanceof DOMException && caught.name === 'AbortError') ||
  (caught instanceof Error && caught.name === 'AbortError');

export const streamRun = async ({
  threadUuid,
  runId,
  signal,
  onSession,
  onThinking,
  onThoughts,
  onAssistantDelta,
  onAssistantFinal,
  onCheckpoint,
  streamTimeoutMs = STREAM_TIMEOUT_MS,
}: StreamRunOptions): Promise<StreamResult> => {
  let response: Response;
  try {
    response = await fetch(streamUrl(threadUuid, runId), {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'text/event-stream' },
      signal,
    });
  } catch (caught) {
    if (isAbortError(caught)) {
      throw new ChatRequestAbortedError('Chat request was cancelled');
    }
    throw caught;
  }

  if (!response.ok) {
    throw new ChatStreamEventError(
      t(
        'The assistant stream could not be opened (%s).',
        String(response.status),
      ),
    );
  }
  if (!response.body) {
    throw new ChatStreamEventError(t('The assistant sent no stream.'));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let cancelled = false;
  let sawDone = false;
  let streamError: string | undefined;
  let timedOut = false;

  const timeoutHandle = setTimeout(() => {
    timedOut = true;
    reader.cancel().catch(() => {
      // The reader is being abandoned anyway, so failing to cancel it cleanly
      // changes nothing for the caller.
    });
  }, streamTimeoutMs);

  try {
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseEvents(buffer);
      buffer = parsed.remainder;

      for (const raw of parsed.events) {
        if (signal?.aborted) {
          throw new ChatRequestAbortedError('Chat request was cancelled');
        }
        const body = frameBody(raw.data);
        switch (raw.event) {
          case 'session': {
            const messageUuid = readString(body, 'message_uuid');
            if (messageUuid) {
              onSession?.(messageUuid);
            }
            break;
          }
          case 'thinking': {
            const line = extractThinkingText(body);
            if (line) {
              onThinking?.(line);
            }
            break;
          }
          case 'thoughts': {
            const delta = readString(body, 'delta');
            if (delta) {
              onThoughts?.(delta);
            }
            break;
          }
          case 'assistant_delta': {
            const delta = readString(body, 'delta');
            if (delta) {
              content += delta;
              onAssistantDelta?.(delta);
            }
            break;
          }
          case 'checkpoint': {
            if (onCheckpoint) {
              // eslint-disable-next-line no-await-in-loop
              await onCheckpoint(parseCheckpoint(body));
            }
            break;
          }
          case 'final': {
            // Replaced, not appended: a dropped or duplicated delta cannot then
            // corrupt what the user ends up reading.
            content = readString(body, 'content') ?? content;
            onAssistantFinal?.(content);
            break;
          }
          case 'cancelled': {
            cancelled = true;
            break;
          }
          case 'error': {
            streamError =
              readString(body, 'error') ?? t('The assistant failed.');
            break;
          }
          case 'done': {
            sawDone = true;
            if (!readBoolean(body, 'ok') && !cancelled && !streamError) {
              streamError = t('The assistant did not finish this run.');
            }
            break;
          }
          default:
            break;
        }
      }
    }
  } catch (caught) {
    if (isAbortError(caught)) {
      throw new ChatRequestAbortedError('Chat request was cancelled');
    }
    throw caught;
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (signal?.aborted) {
    throw new ChatRequestAbortedError('Chat request was cancelled');
  }
  if (timedOut) {
    throw new ChatStreamTimeoutError(runId);
  }
  if (streamError) {
    throw new ChatStreamEventError(streamError);
  }
  if (!sawDone && !cancelled) {
    // The body ended without the terminal frame, so the answer in hand may be
    // partial. Reporting success here would present it as complete.
    throw new ChatStreamEventError(
      t('The assistant stream ended before it finished.'),
    );
  }

  return { content, cancelled };
};

export const cancelChatRun = async (
  threadUuid: string,
  runId: string,
): Promise<void> => {
  await SupersetClient.post({
    endpoint: `${THREAD_ENDPOINT}${encodeURIComponent(threadUuid)}/cancel`,
    jsonPayload: { run_id: runId },
  });
};

export const submitFeedback = async (
  messageUuid: string,
  liked: boolean,
): Promise<void> => {
  await SupersetClient.post({
    endpoint: FEEDBACK_ENDPOINT,
    jsonPayload: { message_uuid: messageUuid, liked },
  });
};

/**
 * Openers the backend suggests for the current page.
 *
 * `enabled` reports whether this deployment generates them at all, which is what
 * lets the caller tell "not configured" from "configured, nothing to suggest
 * here" and only fall back to locally derived prompts in the first case.
 */
export const fetchSuggestedPrompts = async (
  pageContext: Record<string, unknown> | undefined,
): Promise<{ enabled: boolean; prompts: string[] }> => {
  const { json } = await SupersetClient.post({
    endpoint: SUGGESTED_PROMPTS_ENDPOINT,
    jsonPayload: { page_context: pageContext ?? null },
  });
  const result = readRecord(bodyOf(json ?? {}), 'result') ?? {};
  const prompts = Array.isArray(result.prompts) ? result.prompts : [];
  return {
    enabled: result.enabled === true,
    prompts: prompts.filter(
      (prompt): prompt is string => typeof prompt === 'string' && !!prompt,
    ),
  };
};
